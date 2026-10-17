const ROOT = "C:\\";
const VERSION = 1;
const DEFAULT_DATE = "1993-11-01T09:00:00.000Z";
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export class FileSystemError extends Error {
  constructor(code, message, path) {
    super(path ? `${message}: ${path}` : message);
    this.name = "FileSystemError";
    this.code = code;
    this.path = path;
  }
}

const fail = (code, message, path) => {
  throw new FileSystemError(code, message, path);
};
const beneath = (path, directory) =>
  directory === ROOT
    ? path !== ROOT && path.startsWith(ROOT)
    : path.startsWith(directory + "\\");
const bytes = (text) => new TextEncoder().encode(text).byteLength;
const cloneJSON = (value) => JSON.parse(JSON.stringify(value));

function normalizeAbsolute(input, base = []) {
  if (typeof input !== "string" || !input.trim())
    fail("EINVAL", "A path is required");
  let path = input.replaceAll("/", "\\");
  if (path.startsWith("\\\\"))
    fail("EDRIVE", "Network drives are not available", input);
  const drive = /^([a-z]):/i.exec(path);
  if (drive) {
    if (drive[1].toUpperCase() !== "C")
      fail("EDRIVE", "Only drive C: is available", input);
    path = path.slice(2);
    if (!path || path.startsWith("\\")) base = [];
  } else if (path.startsWith("\\")) base = [];
  const parts = [...base];
  for (const raw of path.split("\\")) {
    if (!raw || raw === ".") continue;
    if (raw === "..") {
      parts.pop();
      continue;
    }
    if (/[\x00-\x1f<>:"|?*]/.test(raw) || /[ .]$/.test(raw)) {
      fail(
        "EINVAL",
        "This name contains invalid characters or ends in a dot or space",
        input,
      );
    }
    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(raw)) {
      fail("EINVAL", "This name is reserved by DOS", input);
    }
    parts.push(raw.toUpperCase());
  }
  return ROOT + parts.join("\\");
}

export function normalizePath(path, cwd = ROOT) {
  const basePath = normalizeAbsolute(cwd);
  const base = basePath === ROOT ? [] : basePath.slice(3).split("\\");
  return normalizeAbsolute(path, base);
}

const parentOf = (path) => {
  if (path === ROOT) return ROOT;
  const index = path.lastIndexOf("\\");
  return index <= 2 ? ROOT : path.slice(0, index);
};
const basenameOf = (path) =>
  path === ROOT ? "C:" : path.slice(path.lastIndexOf("\\") + 1);

function info(path, entry) {
  return {
    name: basenameOf(path),
    path,
    type: entry.type,
    size: entry.type === "file" ? bytes(entry.content) : 0,
    modified: entry.modified,
    created: entry.created,
  };
}

function requireEntry(entries, path) {
  const entry = entries.get(path);
  if (!entry) fail("ENOENT", "The file or directory does not exist", path);
  return entry;
}

function requireDirectory(entries, path) {
  const entry = requireEntry(entries, path);
  if (entry.type !== "directory")
    fail("ENOTDIR", "The path is not a directory", path);
  return entry;
}

function touchParent(entries, path, timestamp) {
  const parent = parentOf(path);
  const entry = entries.get(parent);
  if (entry) entries.set(parent, { ...entry, modified: timestamp });
}

function validateSnapshot(snapshot) {
  if (
    !snapshot ||
    snapshot.version !== VERSION ||
    !Array.isArray(snapshot.entries)
  ) {
    fail("EBADSNAPSHOT", "The disk snapshot has an unsupported format");
  }
  const entries = new Map();
  for (const raw of snapshot.entries) {
    if (!raw || typeof raw.path !== "string")
      fail("EBADSNAPSHOT", "An entry has no path");
    const path = normalizePath(raw.path);
    if (entries.has(path))
      fail("EBADSNAPSHOT", "The disk has duplicate paths", path);
    if (raw.type !== "file" && raw.type !== "directory") {
      fail("EBADSNAPSHOT", "An entry has an invalid type", path);
    }
    if (raw.type === "file" && typeof raw.content !== "string") {
      fail("EBADSNAPSHOT", "A file has invalid content", path);
    }
    if (
      typeof raw.modified !== "string" ||
      !Number.isFinite(Date.parse(raw.modified))
    ) {
      fail("EBADSNAPSHOT", "An entry has an invalid modification date", path);
    }
    const created = raw.created ?? raw.modified;
    if (typeof created !== "string" || !Number.isFinite(Date.parse(created))) {
      fail("EBADSNAPSHOT", "An entry has an invalid creation date", path);
    }
    entries.set(path, {
      type: raw.type,
      created: new Date(created).toISOString(),
      modified: new Date(raw.modified).toISOString(),
      ...(raw.type === "file" ? { content: raw.content } : {}),
    });
  }
  if (entries.get(ROOT)?.type !== "directory") {
    fail("EBADSNAPSHOT", "The disk must contain its root directory");
  }
  for (const path of entries.keys()) {
    if (path !== ROOT && entries.get(parentOf(path))?.type !== "directory") {
      fail("EBADSNAPSHOT", "An entry is missing its parent directory", path);
    }
  }
  return entries;
}

function snapshotOf(entries) {
  return {
    version: VERSION,
    entries: [...entries]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, entry]) => ({ path, ...entry })),
  };
}

/** Seed data are real, readable documents/configuration, never placeholder executables. */
export function createSeedSnapshot() {
  const entries = [];
  const directory = (path) =>
    entries.push({
      path,
      type: "directory",
      created: DEFAULT_DATE,
      modified: DEFAULT_DATE,
    });
  const file = (path, content) =>
    entries.push({
      path,
      type: "file",
      content: content.replaceAll("\n", "\r\n"),
      created: DEFAULT_DATE,
      modified: DEFAULT_DATE,
    });
  [
    ROOT,
    "C:\\WINDOWS",
    "C:\\WINDOWS\\SYSTEM",
    "C:\\DOCUMENTS",
    "C:\\TEMP",
  ].forEach(directory);
  file(
    "C:\\DOCUMENTS\\WELCOME.TXT",
    `Welcome to Microsoft Windows 3.1\n\nThis desktop is an interactive browser recreation.\n\nDouble-click an icon in Program Manager to open a program. Use File Manager to browse drive C:, create folders, rename documents, and organize your work. Notepad edits text; Write prepares documents; Paintbrush creates pictures.\n\nYour virtual drive is saved on this browser and device when browser storage is available. Use Export or Download to keep an independent copy of important work. Clearing site data removes this virtual drive.\n\nThis desktop runs browser applications. It does not execute native DOS or Windows binaries.\n\nTip: choose Run from Program Manager's File menu to launch a known program or open a document.\n`,
  );
  file(
    "C:\\DOCUMENTS\\README.TXT",
    `YOUR WORKSPACE\n==============\n\nC:\\DOCUMENTS  Documents, pictures, and calendar data\nC:\\WINDOWS    Readable Windows configuration examples\nC:\\TEMP       A place for temporary files\n\nUseful programs\n---------------\nNOTEPAD   Plain text editor\nWRITE     Document editor\nPBRUSH    Paintbrush\nCALC      Calculator\nWINFILE   File Manager\nCONTROL   Control Panel\n\nThese names select programs included in this browser desktop. Native executable files are not supported.\n\nTry this\n--------\n1. Open NOTES.TXT in Notepad.\n2. Add a few lines and choose File > Save.\n3. Create a folder in File Manager.\n4. Copy your notes into that folder.\n\nThe disk uses case-insensitive C:\\ paths. Long names are supported for convenience.\n`,
  );
  file(
    "C:\\DOCUMENTS\\NOTES.TXT",
    `Project notes\n-------------\n\nThings to try today:\n[ ] Explore the Main program group\n[ ] Change the desktop colors\n[ ] Write and save a short document\n[ ] Draw a picture in Paintbrush\n[ ] Play a game\n\nMeeting notes\nDate:\nSubject:\nActions:\n\n`,
  );
  file(
    "C:\\DOCUMENTS\\SAMPLE.WRI",
    `A Letter from the Desktop\n\nDear friend,\n\nWelcome to your new workspace. A few small windows can hold a surprising amount of possibility: a page of ideas, a sketch, an appointment, or a game between tasks.\n\nUse this sample as the beginning of a letter. Change the words, try the formatting controls, and save a copy under a new name.\n\nBest wishes,\nThe Windows desktop\n`,
  );
  file(
    "C:\\DOCUMENTS\\CALENDAR.CAL",
    JSON.stringify({ version: 1, events: [] }, null, 2),
  );
  file(
    "C:\\DOCUMENTS\\YOUTUBE.CRD",
    "{\n  \"version\": 1,\n  \"cards\": [\n    {\n      \"id\": \"card-yt-1\",\n      \"title\": \"SSL-free-gratis\",\n      \"text\": \"# Cómo instalar un certificado SSL gratis en Ubuntu Server\\n\\nPaso a paso para instalar un certificado SSL gratis en servidor web ubuntu\\n\\nEn [mi canal de youtube](https://youtu.be/CDEaBtEeVwM) hay un video del paso a paso:\\n\\nInstalamos Certbot\\n```csharp\\nsudo apt-get update\\nsudo apt-get install software-properties-common\\nsudo add-apt-repository universe\\nsudo add-apt-repository ppa:certbot/certbot\\nsudo apt-get update\\nsudo apt-get install certbot python-certbot-apache -y\\n```\"\n    },\n    {\n      \"id\": \"card-yt-2\",\n      \"title\": \"VScode-online\",\n      \"text\": \"# Cómo instalar IDE VSCode en Ubuntu Server\\n\\nPaso a paso para instalar el IDE de desarrollo VSCode y correrlo directamente en la nube desde una URL en un Servidor Linux Ubuntu alojado en Amazon AWS\\n\\nEn [mi canal de youtube](https://youtu.be/tWzzzGoNEq4) hay un video del paso a paso:\\n\\n```csharp\\ncd bin\\nsudo wget https://github.com/cdr/code-server/releases/download/2.1698/code-server2.1698-vsc1.41.1-linux-x86_64.tar.gz\\nsudo tar xvzf code-server2.1698-vsc1.41.1-linux-x86_64.tar.gz\\n\\ncd code-server2.1698-vsc1.41.1-linux-x86_64\\nsudo mv code-server /bin\\ncd ..\\nsudo rm -rf code-server2.1698-vsc1.41.1-linux-x86_64.tar.gz\\nsudo rm -rf code-server2.1698-vsc1.41.1-linux-x86_64\\nsudo code-server\\n```\"\n    },\n    {\n      \"id\": \"card-yt-3\",\n      \"title\": \"activar-filtros-pagina-wish\",\n      \"text\": \"# Cómo activar filtros en WISH\\n\\nPaso a paso para activar los filtros en la pagina de WISH, que por algun motivo no los tiene disponibles para filtar el historial de pedidos en la version web.\\n\\nEn [mi canal de youtube](https://youtu.be/07tvORy7cOw) hay un video del paso a paso:\\n\\n1. Entrar a WISH\\n2. Entrar al historial de pedidos\\n3. Inspeccionar la pagina\\n4. Ver en version movil\\n5. Usar los filtros\\n6. Cerrar inspeccionador de codigo\"\n    },\n    {\n      \"id\": \"card-yt-4\",\n      \"title\": \"alerta-hp-client-security\",\n      \"text\": \"# Quitar | Desactivar alerta de HP Client Security\\n\\nPaso a paso para lograr Quitar | Desactivar alerta de HP Client Security:\\nAl instalar todos los drivers en un portatil HP necesarios para activar la huella digital y poder iniciar sesión sin necesidad de escribir una contraseña ... empieza a salir un molesto mensaje de alerta que hasta el día en que escribo este post, no existe manera de quitarlo por configuración. \\n\\nLa única opción que encontré para desactivar esta molesta alerta fue forzarlo por medio de un archivo de configuración que modifique el registro de Windows.\\n\\nLa solución es muy rápida, pues cuenta solo con dos pasos.\\n\\nEn [mi canal de youtube](https://youtu.be/fp5xfIOVwR8) hay un video del paso a paso:\\n\\n```\\nWindows Registry Editor Version 5.00\\n\\n[HKEY_CURRENT_USER\\\\Software\\\\DigitalPersona\\\\Applications\\\\OTAppSettings]\\n\\\"ShowTrainingPrompt\\\"=dword:00000000\\n\\n[HKEY_CURRENT_USER\\\\Software\\\\DigitalPersona\\\\Applications\\\\OTAppSettings\\\\BrowserIntegration]\\n\\\"Firefox_notice\\\"=\\\"-1\\\"\\n\\\"Chrome_notice\\\"=\\\"-1\\\"\\n```\\n1. Se crea un archivo de texto con las lineas anteriores\\n2. Se abre el registro de windows\\n3. Se importa el archivo\"\n    },\n    {\n      \"id\": \"card-yt-5\",\n      \"title\": \"allowed-memory-size-error\",\n      \"text\": \"# Cómo arreglar el error Memory Exhausted de WordPress en WP Engine\\n\\nUn par de lineas necesarias para arreglar en WordPress el error Memory Exhausted, o en otras palabras como incrementar la memoria de PHP (Increase PHP Memory) y en este caso lo haremos a un sitio web que esta alojado en la plataforma WP Engine. Los pasos son utiles para cualquier pagina web en wordpress y en cualquier hosting.\\n\\nEn [mi canal de youtube](https://youtu.be/CDEaBtEeVwM) hay un video del paso a paso:\\n\\nDebemos buscar el archivo \\\"wp-config.php\\\" y agregar las siguientes lineas\\n\\n```php\\ndefine('WP_MEMORY_LIMIT', '256M');\\ndefine( 'WP_MAX_MEMORY_LIMIT', '512M' );\\n```\"\n    },\n    {\n      \"id\": \"card-yt-6\",\n      \"title\": \"ampliar-disco-virtualbox\",\n      \"text\": \"# Resize Disk - VirtualBox - Linux - Windows\\n\\n<p>Dos sencillos pasos para ampliar el disco de virtualbox desde Linux para Windows.</p>\\n<p>En [mi canal de youtube](https://bit.ly/2wSo5iD) hay un video del paso a paso: </p>\\n\\n```csharp\\nvboxmanage modifyhd \\\"/home/ochoa/VirtualBox VMs/win10/win10.vdi\\\" --resize 102400\\n```\\ny en windows:\\n\\n1. Click derecho sobre el boton de inicio\\n2. Administración de discos\\n3. Click derecho extender volumen\"\n    },\n    {\n      \"id\": \"card-yt-7\",\n      \"title\": \"arreglar-error-ciclo-de-objetos-netcore5\",\n      \"text\": \"# Cómo arreglar error ciclos objetos para NetCore 5\\n\\nPaso a paso para arreglar el error \\\"System.Text.Json.JsonException: A possible object cycle was detected. This can either be due to a cycle or if the object depth is larger than the maximum allowed depth of 32. Consider using ReferenceHandler.Preserve on JsonSerializerOptions to support cycles.\\\" para .NetCore 5\\n\\nEn [mi canal de youtube](https://youtu.be/EbKw0Dcaf6o) hay un video del paso a paso:\\n\\n```csharp\\nservices.AddControllers().AddJsonOptions(x => x.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.Preserve);\\n```\"\n    },\n    {\n      \"id\": \"card-yt-8\",\n      \"title\": \"aws-iot-node-topic\",\n      \"text\": \"# Cómo enviar un topic a AWS IOT con Node.js\\n\\n\\nCodigo paso a paso para conectar y enviar un topic a AWS IOT usando Node.js.\\n\\nEn [mi canal de youtube](https://youtu.be/AQay6bFg7jU) hay un video del paso a paso:\\n\\n1. Creamos un objeto en AWS y descargamos el código de ejemplo\\n\\n2. Creamos un proyecto node\\n- npm init\\n\\n3. Agregamos archivo:\\n- index.js\\n  \\n4. instalamos libreria \\n- npm i aws-iot-device-sdk\\n\\n5. Ingresamos el codigo node:\\n\\n```react\\nconst awsIot = require('aws-iot-device-sdk');\\n\\nconst today = new Date();\\nconst date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();\\nconst time = today.getHours() + \\\":\\\" + today.getMinutes() + \\\":\\\" + today.getSeconds();\\nconst dateTime = date + ' ' + time;\\nconst topic = \\\"topic\\\"\\n\\nconst device = awsIot.device({\\n    clientId: 'clientId',\\n    host: 'host',\\n    port: 8883,\\n    keyPath: './private.key',\\n    certPath: './cert.pem',\\n    caPath: './CA.crt',\\n});\\n\\nconst IoTDevice = {\\n    serialNumber: \\\"SN-D7F3C8947867\\\",\\n    dateTime,\\n    activated: true,\\n    device: \\\"MyRaspperry-01\\\",\\n    type: \\\"MySmartIoTDevice\\\",\\n    payload: {}\\n}\\n\\nconst getSensorData = (cb) => getDummySensorData(cb);\\n\\nconst getDummySensorData = (cb) => {\\n    const temperatureData = { temp: '100°C', humidity: '52%' }\\n    return cb(temperatureData)\\n}\\n\\nconst sendData = (data) => {\\n    const telemetryData = {\\n        ...IoTDevice,\\n        payload: data\\n    }\\n    console.log(`STEP - Sending data to AWS  IoT Core'`, telemetryData)\\n    console.log(`---------------------------------------------------------------------------------`)\\n    return device.publish(topic, JSON.stringify(telemetryData))\\n}\\n\\ndevice\\n    .on('connect', function () {\\n        console.log('STEP - Connecting to AWS  IoT Core');\\n        console.log(`---------------------------------------------------------------------------------`)\\n        setInterval(() => getSensorData(sendData), 3000)\\n\\n    });\\n\\ndevice\\n    .on('message', function (topic, payload) {\\n        console.log('message', topic, payload.toString());\\n    });\\n\\ndevice\\n    .on('error', function (topic, payload) {\\n        console.log('Error:', topic, payload.toString());\\n    });\\n```\"\n    },\n    {\n      \"id\": \"card-yt-9\",\n      \"title\": \"babel-regenerator-runtime-error\",\n      \"text\": \"# Cómo solucionar regenerator runtime error nodejs\\n\\nUn par de lineas necesarias para solucionar el error de node.js (ReferenceError: regeneratorRuntime is not defined) que se presenta cuando se usa Babel.\\n\\nEn [mi canal de youtube](https://youtu.be/5Kk3DcBNROE) hay un video del paso a paso:\\n\\n```\\nnpm install -D  @babel/plugin-transform-runtime\\nnpm install @babel/runtime\\n```\\nAgregar al archivo .babelrc\\n```react\\n\\\"plugins\\\": [\\n    [\\\"@babel/plugin-transform-runtime\\\",\\n      {\\n        \\\"regenerator\\\": true\\n      }\\n    ]\\n  ],\\n```\"\n    },\n    {\n      \"id\": \"card-yt-10\",\n      \"title\": \"bonos-forex-sin-deposito\",\n      \"text\": \"# Bonos sin deposito en brokers de Forex\\n\\nA continuación les dejo una URL que recopila los brokers que dan bonos de bienvenida sin necesidad de hacer deposito, algunos solo requieren que confirmemos la cuenta.\\n\\n[https://www.bestfxbonus.com/es/forex-no-deposit-bonus.html](https://www.bestfxbonus.com/es/forex-no-deposit-bonus.html)\"\n    },\n    {\n      \"id\": \"card-yt-11\",\n      \"title\": \"captura-pantalla-celular-windows\",\n      \"text\": \"# Cómo transmitir pantalla del celular a Windows\\n\\n\\nPaso a paso para transmitir la pantalla del celular al escitorio de windows.\\n\\nEn [mi canal de youtube](https://youtu.be/lT1rHovN86M) hay un video del paso a paso:\\n\\n1. Bajar archivos:\\n- <a target=\\\"_blank\\\" href=\\\"https://mega.nz/file/6lFBnAYY#YanFe094ssBA3T5IT9nbNajq-gxPes_me5ziGTyOT3k\\\">platform-tools_r28.0.0-windows.zip</a>\\n- <a target=\\\"_blank\\\" href=\\\"https://mega.nz/file/6tUWlKiT#PUTe5FHlUMcgo4d8qHNjqI7R480Zucar_f-XfxLyAjk\\\">scrcpy-win64.rar</a>\\n2. Descomprimir en una carpeta\\n3. Conectar celular en modo solo carga  \\n4. Ejecutar\\n```csharp\\nadb devices\\nscrcpy\\n```\"\n    },\n    {\n      \"id\": \"card-yt-12\",\n      \"title\": \"cloud9-laravel-57\",\n      \"text\": \"# Instalación Cloud9 Laravel 5.7\\n\\nA continuación describo linea a linea lo que hay que hacer en la consola para tener en menos de 10 minutos un proyecto Laravel 5.7 corriendo en Cloud9.\\n\\nEn [mi canal de youtube](https://bit.ly/2wSo5iD) hay un video del paso a paso: \\n\\n\\n```\\n# Clear existing files\\n#\\nrm hello-world.php php.ini README.md\\n\\n# Install and configure PHP 7.1 Ondrej Repository\\n#\\nsudo add-apt-repository ppa:ondrej/php -y\\nsudo apt-get update\\nsudo apt-get install libapache2-mod-php7.1 -y\\nsudo a2dismod php5\\nsudo a2enmod php7.1\\nsudo apt-get install php7.1-curl php7.1-cli php7.1-dev php7.1-gd php7.1-intl php7.1-mcrypt php7.1-json php7.1-mysql php7.1-opcache php7.1-bcmath php7.1-mbstring php7.1-soap php7.1-xml php7.1-zip -y\\n\\n#Install Laravel\\n#\\nsudo composer global require 'laravel/installer'\\nexport PATH=~/.composer/vendor/bin:$PATH\\nsudo chown -R $USER $HOME/.composer\\nlaravel new \\nrm -rf ./composer\\n\\n#Configure public folder\\n#\\nprintf '%s\\\\n' ':%s/DocumentRoot\\\\ \\\\/home\\\\/ubuntu\\\\/workspace/DocumentRoot\\\\ \\\\/home\\\\/ubuntu\\\\/workspace\\\\/public/g' 'x'  | sudo ex /etc/apache2/sites-enabled/001-cloud9.conf\\n\\n#Select and install the mysql version 5.7 or up\\n#\\nwget https://dev.mysql.com/get/mysql-apt-config_0.8.9-1_all.deb\\nsudo dpkg -i mysql-apt-config_0.8.9-1_all.deb\\nsudo service apache2 restart\\nsudo apt-get update\\nsudo apt-get install mysql-server -y \\nsudo service  mysql restart \\nsudo mysql_upgrade\\n\\n#Configure database and .env file database=laravel, user=root, no password\\n#\\nsudo mysql --user=\\\"root\\\" -e \\\"CREATE DATABASE laravel character set UTF8mb4 collate utf8mb4_bin;\\\"\\nprintf '%s\\\\n' ':%s/DB_DATABASE=homestead/DB_DATABASE=laravel/g' 'x'  | sudo ex .env\\nprintf '%s\\\\n' ':%s/DB_USERNAME=homestead/DB_USERNAME=root/g' 'x'  | sudo ex .env\\nprintf '%s\\\\n' ':%s/DB_PASSWORD=secret/DB_PASSWORD=/g' 'x'  | sudo ex .env\\n\\n#Artisan auth scaffolding and migration\\n#\\nphp artisan make:auth\\nphp artisan migrate\\n\\n#remove laravel installer\\n#\\nrm -rf laravel.sh\\nrm -rf mysql-apt-config_0.8.9-1_all.deb\\n\\n```\"\n    },\n    {\n      \"id\": \"card-yt-13\",\n      \"title\": \"como-agregar-contenedores-turnkey-proxmox\",\n      \"text\": \"# Cómo agregar templates turnkey a proxmox\\n\\nComando de consola para lograr agregar los contenedores de turnkey al administrador de maquinas virtuales Proxmox.\\n\\nEn [mi canal de youtube](https://youtu.be/x2nCjLq2KLE) hay un video del paso a paso:\\n\\n* Ingresamos a nuestro panel de control de Proxmox\\n* Ingresamos a nuestro servidor\\n* Ingresamos al Shell\\n* Copiamos y pegamos el siguiente comando\\n\\n```csharp\\npveam update\\n```\"\n    },\n    {\n      \"id\": \"card-yt-14\",\n      \"title\": \"como-arreglar-problema-cors-netcore\",\n      \"text\": \"# Solucionar problema CORS en .Net Core 5\\n\\nUn par de lineas para solucionar el problema de CORS en API .Net Core 5\\n\\nEn [mi canal de youtube](https://youtu.be/CDEaBtEeVwM) hay un video del paso a paso:\\n\\n- Poner en el archivo startup en la seccion de servicios\\n```csharp\\nservices.AddCors(options =>\\n{\\n    options.AddDefaultPolicy(builder => { \\n        builder\\n        .AllowAnyOrigin()\\n        .AllowAnyHeader()\\n        .AllowAnyMethod(); \\n    });\\n});\\n```\\n\\n- Poner en el archivo startup en la seccion de aplicaciones\\n```csharp\\napp.UseCors();\\n```\"\n    },\n    {\n      \"id\": \"card-yt-15\",\n      \"title\": \"como-buscar-librerias-flutter\",\n      \"text\": \"# Cómo buscar y encontrar librerias flutter\\n\\nUna página web para buscar librerias Flutter\\n\\nEn [mi canal de youtube](https://youtu.be/DHhiFybG-Mg) hay un video del paso a paso:\\n\\n<a target=\\\"_blank\\\" href=\\\"{{ page.link }}\\\">https://fluttergems.dev/</a>\"\n    },\n    {\n      \"id\": \"card-yt-16\",\n      \"title\": \"como-instalar-docker-portainer-\",\n      \"text\": \"# Cómo instalar docker en Raspbian linux\\n\\nPaso a paso para tener docker instalado junto con un administrador visual de contenedores en una Raspberry Pi.\\n\\nEn [mi canal de youtube](https://youtu.be/EbKw0Dcaf6o) hay un video del paso a paso:\\n\\nInstalar docker\\n```csharp\\nsudo apt update\\nsudo apt upgrade\\nsudo apt install raspberrypi-kernel raspberrypi-kernel-headers\\ncurl -sSL https://get.docker.com | sh\\nsudo usermod -aG docker pi\\nsudo reboot\\ndocker version\\n```\\n\\nInstalar Portainer\\n```csharp\\ndocker run -itd -p 8000:8000 -p 9000:9000 --name=portainer --restart=always -v /var/run/docker.sock:/var/run/docker.sock -v /docker/portainer:/data portainer/portainer-ce\\nlocalhost:9000\\ndocker ps\\n```\"\n    },\n    {\n      \"id\": \"card-yt-17\",\n      \"title\": \"como-instalar-windows-proxmox\",\n      \"text\": \"# Cómo instalar windows en proxmox\\n\\nPaso a paso para poder instalar una maquina virtual windows en Proxmox.\\n\\nEn [mi canal de youtube](https://youtu.be/At5CpVwy-iY) hay un video del paso a paso:\\n\\n* Descargar ISO Windows y agregarlo a Proxmox\\n* Descargar ISO <a target=\\\"_blank\\\" href=\\\"{{ page.link }}\\\">Windows VirtIO Drivers</a> y agregarlo a Proxmox\\n* Crear maquina virtual\\n* System = Qemu\\n* Hard Disck = SCSI - cache write back\\n* CPU = 4 cores\\n* Network = VirtIO\\n* Montar CDRoom con ISO VirtIO\\n* Cargar drivers para instalacion desde el CDRoom\\n* Instalar drivers del controlador desde el CDRoom\\n* Instalar Guest Agent\"\n    },\n    {\n      \"id\": \"card-yt-18\",\n      \"title\": \"como-saber-el-nombre-de-un-video-bloqueado-en-youtube\",\n      \"text\": \"# Cómo saber el nombre de un video bloqueado o borrado de youtube\\n\\nPaso a paso de cómo saber el nombre de un video borrado o bloqueado en una lista de reproducción en youtube.\\n\\nEn [mi canal de youtube](https://youtu.be/5JCQUHk7rP4) hay un video del paso a paso:\\n\\n1. Buscar y dar clic en el video bloqueado o borrado\\n2. Copiar la URL del video donde esta el código\\n3. Abrir google\\n4. Pegar la url del video y darle buscar\\n5. Revisar los resultado en busqueda del nombre del video\\n6. Copio el nombre del video en youtube y vuelvo a agregarlos a mi lista de reproducción\"\n    },\n    {\n      \"id\": \"card-yt-19\",\n      \"title\": \"dark-linux-mint\",\n      \"text\": \"# Instalación Theme Arc-Dark Linux Mint\\n\\nA continuación describo los comandos de consola SSH para instalar en menos de 5 minutos el Theme Arc-Dark para Linux Mint.\\n\\nEn [mi canal de youtube](https://bit.ly/2wSo5iD) hay un video del paso a paso:\\n\\n```csharp\\nsudo rm -rf /usr/share/themes/{Arc,Arc-Darker,Arc-Dark}\\nrm -rf ~/.local/share/themes/{Arc,Arc-Darker,Arc-Dark}\\nrm -rf ~/.themes/{Arc,Arc-Darker,Arc-Dark}\\n\\nsudo apt-get install autoconf automake pkg-config libgtk-3-dev\\ngit clone https://github.com/horst3180/arc-theme --depth 1 && cd arc-theme\\n\\n./autogen.sh --prefix=/usr\\nsudo make install\\n```\"\n    },\n    {\n      \"id\": \"card-yt-20\",\n      \"title\": \"delete-all-tables-sql\",\n      \"text\": \"# Cómo eliminar todas las tablas SQL\\n\\nCódigo SQL para eliminar todas las tablas de una base de datos SQL sin eliminar la base de datos\\n\\nEn [mi canal de youtube](https://youtu.be/CDEaBtEeVwM) hay un video del paso a paso:\\n\\n```sql\\nDECLARE @sql NVARCHAR(max)=''\\n\\nSELECT @sql += ' Drop table ' + QUOTENAME(TABLE_SCHEMA) + '.'+ QUOTENAME(TABLE_NAME) + '; '\\nFROM   INFORMATION_SCHEMA.TABLES\\nWHERE  TABLE_TYPE = 'BASE TABLE'\\n\\nExec Sp_executesql @sql\\n```\"\n    },\n    {\n      \"id\": \"card-yt-21\",\n      \"title\": \"delete-inactive-contact-facebook\",\n      \"text\": \"# Cómo listar contactos inactivos de facebook\\n\\nCodigo javascript que nos permite listar todos los contactos inactivos de facebook y despues poder borrarlos\\n\\nEn [mi canal de youtube](https://youtu.be/CDEaBtEeVwM) hay un video del paso a paso:\\n\\n```javascript\\nlet segundos = 0;\\n\\nfunction hacerScrollUnMinuto() {\\nif(segundos < 10) {\\nsegundos++\\nwindow.scrollBy(0, 1000)\\nsetTimeout(hacerScrollUnMinuto, 1000)\\n}\\n}\\nfunction mostrarInactivos() {\\nlet activos = document.querySelectorAll('.right[data-store*=is_deactivated\\\\\\\\\\\"\\\\\\\\:false')\\nactivos.forEach(p => p.parentElement.parentElement.parentElement.parentElement.remove())\\nwindow.scrollBy(0, 1000)\\n}\\n```\"\n    },\n    {\n      \"id\": \"card-yt-22\",\n      \"title\": \"dependencias-package-npm\",\n      \"text\": \"# Cómo arreglar dependencias NPM package.json\\n\\nPaso a paso para arreglar las dependencias registradas en el package.json y poder correr los proyectos correctamente\\n\\nEn [mi canal de youtube](https://youtu.be/ut9QZQX2_as) hay un video del paso a paso:\\n\\n```csharp\\n//Instalamos\\nnpm i -g npm-check-updates\\n\\n//ejecutamos\\nncu -u\\n```\"\n    },\n    {\n      \"id\": \"card-yt-23\",\n      \"title\": \"deploy-api-netcore-aws\",\n      \"text\": \"# Cómo hacer deploy App Net Core en AWS\\n\\n\\nCódigo paso a paso para desplegar un proyecto API Net Core en AWS Elastic Beanstalk.\\n\\nEn [mi canal de youtube](https://youtu.be/9yIJg7i-Xxo) hay un video del paso a paso:\\n\\n1. Crear Aplicación Elastic Beanstalk\\n- Application Name / Enviroment / Domain / Platform Linux\\n- Create Service Role\\n- Create EC2 Intance Profile / IAM\\n- Create Role / AWS Service / UseCase = EC2\\n- Add Policies = WebTier / WorkerTier / MulticontainerDocker\\n- VPC / Public IP Address = Activated / Instance Subnets \\n- EC2 Security Gropus = default\\n \\n2. Configurar Visual Studio\\n- Crear Usuario / Crear Grupo / Crear Role = administrator\\n- Descargar e Instalar = AWS Toolkit for Visual Studio\\n- Crear perfil / Access Key / Secret Key\"\n    },\n    {\n      \"id\": \"card-yt-24\",\n      \"title\": \"deploy-nextjs-to-heroku\",\n      \"text\": \"# Cómo hacer Deploy de una app next.js en Heroku\\n\\nUn par de lineas necesarias para poder hacer deploy correctamente de una aplicación next.js desde Github a Heroku.\\n\\nEn [mi canal de youtube](https://youtu.be/5Kk3DcBNROE) hay un video del paso a paso:\\n\\n```react\\n\\\"start\\\": \\\"next start -p $PORT\\\",\\n\\\"heroku-postbuild\\\": \\\"npm run build\\\"\\n```\"\n    },\n    {\n      \"id\": \"card-yt-25\",\n      \"title\": \"deploy-react-app-github\",\n      \"text\": \"# Cómo desplegar una app React + Vite a Github Pages\\n\\n\\nCódigo paso a paso para hacer un deploy de una aplicación React + Vite en Github Pages.\\n\\nEn [mi canal de youtube](https://youtu.be/QZ7y90shOPY) hay un video del paso a paso:\\n--- \\n1 Creamos un proyecto React + Vite \\n```react\\nnpm create vite@latest\\n```\\n\\n2 Creamos un repositorio en Github\\n\\n3 Iniciamos y configuramos el git en el nuevo proyecto\\n\\n4 Agregamos al package.json\\n```react\\n\\\"homepage\\\": \\\"https://juandavid.site/reactapp\\\" \\n\\\"predeploy\\\":\\\"npm run build\\\",\\n\\\"deploy\\\":\\\"gh-pages -d dist\\\",\\n```\\n\\n5 Agregamos al vite.config.ts\\n```react\\nbase: \\\"https://juandavid.site/reactapp\\\"\\n```\\n\\n6 Instalamos libreria gh-pages\\n```react\\npnpm add gh-pages -D\\n```\\n\\n7 Ejecutamos\\n```react\\nnpm run deploy\\n```\"\n    },\n    {\n      \"id\": \"card-yt-26\",\n      \"title\": \"deploy-react-aws\",\n      \"text\": \"# Cómo hacer deploy de react.js en AWS\\n\\n\\nCódigo paso a paso para desplegar un proyecto React.JS en AWS Elastic Beanstalk.\\n\\nEn [mi canal de youtube](https://youtu.be/YmArl7GQqCc) hay un video del paso a paso:\\n\\n1. Crear S3\\n- Block all public access\\n- Properties / Static website hosting / index.html\\n- Bucket policy / S3 / GetObject\\n- \\\"Principal\\\": \\\"*\\\"\\n \\n2. Crear proyecto Reat.JS\\n- npx create-react-app reactapp\\n- npm run build\\n    \\n4. Hacer deploy\\n- login en aws\\n- https://aws.amazon.com/es/cli/\\n- aws --version\\n- aws configure\\n```csharp\\nDefault region name [None]: us-west-2\\nDefault output format [None]: json\\n```   \\n- aws s3 sync build/ s3://reactapp-bucket\"\n    },\n    {\n      \"id\": \"card-yt-27\",\n      \"title\": \"descargar-iso-windows10\",\n      \"text\": \"# Cómo descargar ISO windows 10 desde Microsoft\\n\\nPaso a paso para descargar el ISO original de windows 10 desde Microsoft\\n\\nEn [mi canal de youtube](https://youtu.be/SUPPpapA3lg) hay un video del paso a paso:\\n\\n1. Buscar en google \\\"windows 10 iso\\\"\\n2. Entrar en la primera respuesta que es la pagina original de Microsoft\\n3. Inspeccionar la pagina\\n4. Ver en version movil\\n5. Simular Ipad\\n6. Seleccionar edicción e idioma\\n7. Seleccionar 32bit o 64bit\"\n    },\n    {\n      \"id\": \"card-yt-28\",\n      \"title\": \"docker-servidor-Jekyll\",\n      \"text\": \"# Cómo ejecutar un proyecto Jekyll localmente\\n\\n\\nPaso a paso para correr un proyecto Jeckyll localmente y poder editarlo.\\n\\nEn [mi canal de youtube](https://youtu.be/WRT0RgIEXus) hay un video del paso a paso:\\n\\n1. Crear archivo docker-compose.yaml\\n```csharp\\nservices:\\n  jekyll:\\n    image: jekyll/jekyll\\n    command: jekyll serve --watch --host 0.0.0.0\\n    ports:\\n\\\"4000:4000\\\"\\n    volumes:\\n.:/srv/jekyll\\n```\"\n    },\n    {\n      \"id\": \"card-yt-29\",\n      \"title\": \"drivers-online-gratis\",\n      \"text\": \"# Cómo descargar e instalar drivers facil y rápido\\n\\nPaso a paso para bajar aplicativo que analiza nuestro equipo y automaticamente baja los drivers y los instala por nosotros. Adicional a esto tiene un paquete extenso de programas muy útiles, herramientas de administracion, seguridad y otros que pueden ser instalados al tiempo\\n\\nEn [mi canal de youtube](https://youtu.be/GJ-GbLifU2Q) hay un video del paso a paso:\\n\\n1. Ingresar a la página: <a target=\\\"_blank\\\" href=\\\"https://driverpack.io/es\\\">https://driverpack.io/es</a>\\n2. Descargar instalador .exe\\n3. Activar modo experto\\n4. Activar o desactivar programas y/o drivers\\n5. Instalar y reiniciar el equipo\"\n    },\n    {\n      \"id\": \"card-yt-30\",\n      \"title\": \"encriptacion-aes-facturacion-electronica-cadena\",\n      \"text\": \"# Encriptación factura electrónica AES\\n\\nEste tutorial es un código muy simple para encriptar los números de facturas electrónicas y poderlas bajar en PDF desde la plataforma de CADENA\\n\\nEn [mi canal de youtube](https://youtu.be/Sp00ZqfBnM4) hay un video del paso a paso:\\n\\n```csharp\\nprivate static readonly int tamanyoClave = 32;\\nprivate static readonly int tamanyoVector = 16;\\n// Define la palabra clave para el cifrado y\\nprivate static readonly string Clave = \\\"Cadena_clave_para_cifrar\\\";\\nprivate static readonly string Vector = \\\"m2PCs0Ju9m1u3AIPkO3RUQ==\\\";\\n// se convierte el vector y la key a bytes\\npublic static byte[] Key = SHA256.Create().ComputeHash(Encoding.UTF8.GetBytes(Clave));\\npublic static byte[] IV = Convert.FromBase64String(Vector);\\n\\nArray.Resize(ref Key, tamanyoClave);\\nArray.Resize(ref IV, tamanyoVector);\\nRijndael RijndaelAlg = Rijndael.Create();\\nMemoryStream memoryStream = new MemoryStream();\\nCryptoStream cryptoStream = new CryptoStream(memoryStream, RijndaelAlg.CreateEncryptor(Key, IV), CryptoStreamMode.Write);\\nbyte[] txtPlanoBytes = UTF8Encoding.UTF8.GetBytes(txtPlano);\\ncryptoStream.Write(txtPlanoBytes, 0, txtPlanoBytes.Length);\\ncryptoStream.FlushFinalBlock();\\nbyte[] cipherMessageBytes = memoryStream.ToArray();\\nmemoryStream.Close();\\ncryptoStream.Close();\\nvar numeroDeFacturaEncriptado = Convert.ToBase64String(cipherMessageBytes);\\n```\"\n    },\n    {\n      \"id\": \"card-yt-31\",\n      \"title\": \"entity-user-net-core-5\",\n      \"text\": \"# Cómo instalar EntityUser y JWT NetCore 5\\n\\nPaso a paso para instalar el servicio EntityUser que trae por defecto .Net Core 5 y activar JWT para el login de usuarios desde un front-end\\n\\nEn [mi canal de youtube](https://youtu.be/EbKw0Dcaf6o) hay un video del paso a paso:\\n\\n- Crear la carpeta Models\\n- Crear el modelo: ApplicationUser\\n```csharp\\npublic class ApplicationUser : IdentityUser\\n{\\n}\\n```\\n- Crear un modelo de prueba\\n- Crear un controlador de prueba para el modelo de prueba\\n- Renombrar el DbContext por: ApplicationDbContext\\n- Actualizar el DbContext\\n\\n```csharp\\n: IdentityDbContext<ApplicationUser>\\n```\\n\\n- Actualizar el ConnectionString\\n- Actualizar dependencias\\n- Crear migracion\\n- Actualizar base de datos\\n- Crear modelo: RegisterModel\\n\\n```csharp\\n[Required(ErrorMessage =\\\"User Name is required\\\")]\\npublic string Username { get; set; }\\n\\n[EmailAddress]\\n[Required(ErrorMessage = \\\"Email is required\\\")]\\npublic string Email { get; set; }\\n\\n[Required(ErrorMessage = \\\"Password is required\\\")]\\npublic string Password { get; set; }\\n```\\n\\n- Crear modelo: LoginModel\\n\\n```csharp\\n[Required(ErrorMessage = \\\"User Name is required\\\")]\\npublic string Username { get; set; }\\n\\n[Required(ErrorMessage = \\\"Password is required\\\")]\\npublic string Password { get; set; }\\n```\\n\\n- Crear el controlador: AccountController\\n- Agregar el constructor al controlador\\n\\n```csharp\\nprivate readonly UserManager<ApplicationUser> userManager;\\nprivate readonly RoleManager<IdentityRole> roleManager;\\nprivate readonly IConfiguration _configuration;\\n\\npublic AccountController(UserManager<ApplicationUser> userManager, RoleManager<IdentityRole> roleManager, IConfiguration configuration)\\n{\\n    this.userManager = userManager;\\n    this.roleManager = roleManager;\\n    _configuration = configuration;\\n}\\n```\\n\\n- Agregar el metodo registrar dentro del controlador\\n\\n```csharp\\n[HttpPost]\\n[Route(\\\"register\\\")]\\npublic async Task<IActionResult> Register([FromBody] RegisterModel model)\\n{\\n    var userExists = await userManager.FindByNameAsync(model.Username);\\n    if (userExists != null)\\n        return StatusCode(StatusCodes.Status500InternalServerError, new Response { Status = \\\"Error\\\", Message = \\\"User already exists!\\\" });\\n\\n    ApplicationUser user = new ApplicationUser()\\n    {\\n        Email = model.Email,\\n        SecurityStamp = Guid.NewGuid().ToString(),\\n        UserName = model.Username\\n    };\\n    var result = await userManager.CreateAsync(user, model.Password);\\n    if (!result.Succeeded)\\n        return StatusCode(StatusCodes.Status500InternalServerError, new Response { Status = \\\"Error\\\", Message = \\\"User creation failed! Please check user details and try again.\\\" });\\n\\n    return Ok(new Response { Status = \\\"Success\\\", Message = \\\"User created successfully!\\\" });\\n}\\n```\\n\\n- Agregar en metodo login dentro del controlador\\n\\n```csharp\\n[HttpPost]\\n[Route(\\\"login\\\")]\\npublic async Task<IActionResult> Login([FromBody] LoginModel model)\\n{\\n    var user = await userManager.FindByNameAsync(model.Username);\\n    if (user != null && await userManager.CheckPasswordAsync(user, model.Password))\\n    {\\n        var userRoles = await userManager.GetRolesAsync(user);\\n\\n        var authClaims = new List<Claim>\\n        {\\n            new Claim(ClaimTypes.Name, user.UserName),\\n            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),\\n        };\\n\\n        foreach (var userRole in userRoles)\\n        {\\n            authClaims.Add(new Claim(ClaimTypes.Role, userRole));\\n        }\\n\\n        var authSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration[\\\"JWT:SecretKey\\\"]));\\n\\n        var token = new JwtSecurityToken(\\n            issuer: _configuration.GetSection(\\\"JWT:ValidIssuer\\\").Value,\\n            audience: _configuration.GetSection(\\\"JWT:ValidAudience\\\").Value,\\n            expires: DateTime.Now.AddHours(3),\\n            claims: authClaims,\\n            signingCredentials: new SigningCredentials(authSigningKey, SecurityAlgorithms.HmacSha256)\\n        );\\n\\n        return Ok(new\\n        {\\n            token = new JwtSecurityTokenHandler().WriteToken(token),\\n            expiration = token.ValidTo\\n        });\\n    }\\n    return Unauthorized();\\n}\\n```\\n\\n- Agregamos los servicios en startup\\n\\n```csharp\\n// For Identity\\nservices.AddIdentity<ApplicationUser, IdentityRole>()\\n.AddEntityFrameworkStores<ApplicationDbContext>()\\n.AddDefaultTokenProviders();\\n\\n// Adding Authentication\\nservices.AddAuthentication(options =>\\n{\\n    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;\\n    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;\\n    options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;\\n})\\n\\n// Adding Jwt Bearer\\n.AddJwtBearer(options =>\\n{\\n    options.SaveToken = true;\\n    options.RequireHttpsMetadata = false;\\n    options.TokenValidationParameters = new TokenValidationParameters()\\n    {\\n        ValidateIssuer = true,\\n        ValidateAudience = true,\\n        ValidAudience = Configuration.GetSection(\\\"JWT:ValidAudience\\\").Value,\\n        ValidIssuer = Configuration.GetSection(\\\"JWT:ValidIssuer\\\").Value,\\n        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Configuration.GetSection(\\\"JWT:SecretKey\\\").Value))\\n    };\\n});\\n```\\n\\n- Actualizamos el servicio de Swagger en startup\\n\\n```csharp\\nservices.AddSwaggerGen(swagger =>\\n{\\n    //This is to generate the Default UI of Swagger Documentation\\n    swagger.SwaggerDoc(\\\"v1\\\", new OpenApiInfo\\n    {\\n        Version = \\\"v1\\\",\\n        Title = \\\"ASP.NET 5 Web API\\\",\\n        Description = \\\"Authentication and Authorization in ASP.NET 5 with JWT and Swagger\\\"\\n    });\\n    // To Enable authorization using Swagger (JWT)\\n    swagger.AddSecurityDefinition(\\\"Bearer\\\", new OpenApiSecurityScheme()\\n    {\\n        Name = \\\"Authorization\\\",\\n        Type = SecuritySchemeType.ApiKey,\\n        Scheme = \\\"Bearer\\\",\\n        BearerFormat = \\\"JWT\\\",\\n        In = ParameterLocation.Header,\\n        Description = \\\"Enter 'Bearer' [space] and then your valid token in the text input below.\\\\r\\\\n\\\\r\\\\nExample: \\\\\\\"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\\\\\\\"\\\",\\n    });\\n    swagger.AddSecurityRequirement(new OpenApiSecurityRequirement\\n    {\\n        {\\n            new OpenApiSecurityScheme\\n            {\\n                Reference = new OpenApiReference\\n                {\\n                    Type = ReferenceType.SecurityScheme,\\n                    Id = \\\"Bearer\\\"\\n                }\\n            },\\n            new string[] {}\\n        }\\n    });\\n});\\n```\\n\\n- Agregamos las aplicaciones en startup\\n\\n```csharp\\napp.UseAuthentication();\\napp.UseAuthorization();\\n```\\n\\n- Agregamos al: appsettings\\n\\n```csharp\\n\\\"JWT\\\": {\\n  \\\"SecretKey\\\": \\\"LJLKSFJYEWIYEWBBLKASJDASDASDTWEBNVASNBDVCAS\\\",\\n  \\\"ValidAudience\\\": \\\"https://localhost:44324\\\",\\n  \\\"ValidIssuer\\\": \\\"https://localhost:44324\\\"\\n}\\n```\\n- Proteger los metodos con: [Authorize]\"\n    },\n    {\n      \"id\": \"card-yt-32\",\n      \"title\": \"error-tinta-canon-g3100-G3000-series\",\n      \"text\": \"# Problema Impresora Canon G3100 - G3000 series\\n\\nA continuación doy una solución rápida al problema de aire en las mangueras de una impresora Canon G3100 o G3000 Series, que hace que algunos colores o un color no imprima correctamente.\\n\\nEn [mi canal de youtube](https://youtu.be/KvldwGjCg5M) hay un video del paso a paso:\\n\\nHay tres niveles de mantenimeinto para este problema (Limpieza del cabezal de impresión: Standar, A fondo y profundo). Cada una de ellas lleva un consumo mayor de tiempo y de tinta para realizarse.\\n\\n1. Lo primero a revisar el nivel de tinta (no debe estar en el nivel mas bajo), pues lo que vamos a hacer genera un gasto importante de tinta y los manuales dicen que si se queda sin tinta se pueden generar problemas graves al sistema.\\n2. Nivel uno: Limpieza del cabezal de impresión Standar (mantenga pulsado el botón Parar (Stop) hasta que la luz de Alarma (Alarm) parpadee 2 veces y, a continuación, suelte el botón.)\\n3. Revisar si el problema esta resuelto con la impresion de un patron de prueba (mantenga pulsado el botón Parar (Stop) hasta que la luz de Alarma (Alarm) parpadee 1 vez y, a continuación, suelte el botón.) \\n4. Nivel dos: Limpieza del cabezal de impresión a fondo (mantenga pulsado el botón Parar (Stop) hasta que la luz de Alarma (Alarm) parpadee 3 veces y, a continuación, suelte el botón.)\\n5. Revisar si el problema esta resuelto con la impresion de un patron de prueba (mantenga pulsado el botón Parar (Stop) hasta que la luz de Alarma (Alarm) parpadee 1 vez y, a continuación, suelte el botón.)\\n6. Nivel tres: Limpieza del cabezal de impresión Profundo (mantenga pulsado el botón Parar (Stop) hasta que la luz de Alarma (Alarm) parpadee 5 veces y, a continuación, suelte el botón.)\\n\\nEste ultimo nivel es la limpieza más profunda, que más tiempo lleva realizarla y que más tinta consume\"\n    },\n    {\n      \"id\": \"card-yt-33\",\n      \"title\": \"expert-advisor-metatrader5\",\n      \"text\": \"# Cómo crear un Expert Advisor metatrader 5\\n\\n\\nCódigo paso a paso para crear un expert advisor que nos ayude a administrar las posiciones que vamos abriendo manualmente.\\n\\nEn [mi canal de youtube](https://youtu.be/rcEfVyMp8XE) hay un video del paso a paso:\\n \\n1. Crear un nuevo proyecto.\\n\\n2. Crear variables:\\n   - globalTrailing\\n   - globaltrailingStop\\n   - globalStopLoss\\n   - globalSpread\\n\\n4. Copiar codigo:\\n   \\n```php\\n//+------------------------------------------------------------------+\\n//|                                                      vikingo.mq5 |\\n//|                                  Copyright 2023, MetaQuotes Ltd. |\\n//|                                             https://www.mql5.com |\\n//+------------------------------------------------------------------+\\n#property copyright \\\"Copyright 2023, MetaQuotes Ltd.\\\"\\n#property link      \\\"https://www.mql5.com\\\"\\n#property version   \\\"1.00\\\"\\n\\n#include <Trade\\\\Trade.mqh>\\nCTrade trade;\\n\\n//--- input parameters\\ninput int globalTrailing;\\ninput int globalTrailingStop;\\ninput int globalStopLoss;\\ninput int globalSpread;\\n\\nbool     test = false;\\nbool     globalPositionInit = true;\\nlong     globalPositionTrailing;\\ndouble   globalTickValue;\\nulong    globalTicket;\\nstring   globalSymbol;\\nstring   globalPositionSymbol;\\nlong     globalPositionType;\\nlong     globalPositionOpen;\\nlong     globalPositionStop;\\ndouble   globalGross;\\nlong     globalPrice;\\n//+------------------------------------------------------------------+\\n//| Expert initialization function                                   |\\n//+------------------------------------------------------------------+\\nint OnInit()\\n  {\\n//---\\n   globalSymbol = Symbol();\\n   globalTickValue = SymbolInfoDouble(Symbol(), SYMBOL_TRADE_TICK_VALUE);\\n//---\\n   return(INIT_SUCCEEDED);\\n  }\\n\\n//+------------------------------------------------------------------+\\n//| Expert tick function                                             |\\n//+------------------------------------------------------------------+\\nvoid OnTick()\\n  {\\n   if(test)\\n     {\\n      ulong ticket = trade.Buy(0.01, Symbol(), SymbolInfoDouble(Symbol(), SYMBOL_ASK));\\n      //ulong ticket = trade.Sell(0.01, Symbol(), SymbolInfoDouble(Symbol(), SYMBOL_BID));\\n      test = false;\\n     }\\n   int total = PositionsTotal();\\n   if(total > 0)\\n     {\\n      globalTicket = PositionGetTicket(0);\\n      globalGross = PositionGetDouble(POSITION_PROFIT);\\n      globalPositionSymbol = PositionGetString(POSITION_SYMBOL);\\n      globalPositionOpen = priceConvert(PositionGetDouble(POSITION_PRICE_OPEN));\\n      globalPositionType = PositionGetInteger(POSITION_TYPE);\\n\\n      if(globalPositionType == POSITION_TYPE_SELL)\\n        {\\n         globalPrice = priceConvert(SymbolInfoDouble(globalPositionSymbol, SYMBOL_ASK));\\n         if(globalPositionInit)\\n           {\\n            globalPositionStop = globalPositionOpen + globalStopLoss;\\n            globalPositionTrailing = globalPositionOpen - globalTrailing - globalSpread;\\n            globalPositionInit = false;\\n           }\\n\\n         if(globalPrice <= globalPositionTrailing && globalGross > 0)\\n           {\\n            globalPositionTrailing = globalPrice - globalTrailing;\\n            globalPositionStop = globalPrice + globalTrailingStop;\\n           }\\n\\n         if(globalPrice >= globalPositionStop)\\n           {\\n            bool result = trade.PositionClose(globalTicket);\\n            if(result)\\n              {\\n               resetInit();\\n              }\\n            else\\n              {\\n               Print(\\\"No se pudo cerrar la posición de venta\\\");\\n              }\\n           }\\n        }\\n      else\\n         if(globalPositionType == POSITION_TYPE_BUY)\\n           {\\n            globalPrice = priceConvert(SymbolInfoDouble(globalPositionSymbol, SYMBOL_BID));\\n            if(globalPositionInit)\\n              {\\n               globalPositionStop = globalPositionOpen - globalStopLoss;\\n               globalPositionTrailing = globalPositionOpen + globalTrailing + globalSpread;\\n               globalPositionInit = false;\\n              }\\n\\n            if(globalPrice >= globalPositionTrailing && globalGross > 0)\\n              {\\n               globalPositionTrailing = globalPrice + globalTrailing;\\n               globalPositionStop = globalPrice - globalTrailingStop;\\n              }\\n\\n            if(globalPrice <= globalPositionStop)\\n              {\\n               bool result = trade.PositionClose(globalTicket);\\n               if(result)\\n                 {\\n                  resetInit();\\n                 }\\n               else\\n                 {\\n                  Print(\\\"No se pudo cerrar la posición de compra\\\");\\n                 }\\n              }\\n           }\\n      Print(\\\"Ticket: \\\", globalTicket, \\\" Apertura: \\\", globalPositionOpen, \\\" Profit: \\\", globalGross, \\\" Precio: \\\", globalPrice, \\\" Trail: \\\", globalPositionTrailing, \\\" Stop: \\\", globalPositionStop);\\n     }\\n   else\\n     {\\n      resetInit();\\n     }\\n  }\\n\\n//+------------------------------------------------------------------+\\n//| PRICE CONVERT                                                    |\\n//+------------------------------------------------------------------+\\nlong priceConvert(double price)\\n  {\\n   string price_str = DoubleToString(price, 5);\\n   string parts[];\\n   int count = StringSplit(price_str, '.', parts);\\n   if(StringLen(parts[1])==4)\\n     {\\n      parts[1] = parts[1] + \\\"0\\\";\\n     }\\n   long price_int = StringToInteger(parts[0] + parts[1]);\\n   return price_int;\\n  }\\n//+------------------------------------------------------------------+\\n\\n//+------------------------------------------------------------------+\\n//| RESET INIT                                                       |\\n//+------------------------------------------------------------------+\\nvoid resetInit()\\n  {\\n   globalPositionInit = true;\\n   globalPositionTrailing = 0;\\n   globalTickValue = 0;\\n   globalTicket = 0;\\n   globalSymbol = \\\"\\\";\\n   globalPositionSymbol = \\\"\\\";\\n   globalPositionType = 0;\\n   globalPositionOpen = 0;\\n   globalPositionStop = 0;\\n   globalGross = 0;\\n   globalPrice = 0;\\n  }\\n//+------------------------------------------------------------------+\\n\\n//+------------------------------------------------------------------+\\n//| UPDATE STOPLOSS                                                  |\\n//+------------------------------------------------------------------+\\nvoid setStopLoss()\\n  {\\n   double priceOpen = PositionGetDouble(POSITION_PRICE_OPEN);\\n   double tickSize = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);\\n   double newStopLoss = priceOpen - globalStopLoss * tickSize;\\n   trade.OrderModify(globalTicket, 0, priceOpen, newStopLoss, 0, CLR_NONE);\\n  }\\n//+------------------------------------------------------------------+\"\n    },\n    {\n      \"id\": \"card-yt-34\",\n      \"title\": \"exportar-CSV-firebase\",\n      \"text\": \"# Cómo importar un excel o CSV a firebase firestore\\n\\nPaso a paso para importar un archivo excel o CSV a una base de datos firestore de firebase \\n\\nEn [mi canal de youtube](https://youtu.be/ut9QZQX2_as) hay un video del paso a paso:\\n\\nIngresamos a consola\\n- https://console.cloud.google.com\\n\\n```\\ngcloud config set project IDPROJECT\\nmkdir csv\\nnpm init\\nnpm install @google-cloud/firestore\\nnpm install csv-parse\\ntouch csvExport.js\\nnode csvExport.js archivo.csv\\n```\\n\\n```javascript\\nconst {readFile}  = require('fs').promises;\\nconst {promisify} = require('util');\\nconst parse       = promisify(require('csv-parse'));\\nconst {Firestore} = require('@google-cloud/firestore');\\n\\nif (process.argv.length < 3) {\\n  console.error('Please include a path to a csv file');\\n  process.exit(1);\\n}\\n\\n\\nconst db = new Firestore();\\n\\nfunction writeToFirestore(records) {\\n  const batchCommits = [];\\n  let batch = db.batch();\\n  records.forEach((record, i) => {\\n    var docRef = db.collection('fasecolda').doc(record.Codigo);\\n    batch.set(docRef, record);\\n    if ((i + 1) % 500 === 0) {\\n      console.log(`Writing record ${i + 1}`);\\n      batchCommits.push(batch.commit());\\n      batch = db.batch();\\n    }\\n  });\\n  batchCommits.push(batch.commit());\\n  return Promise.all(batchCommits);\\n}\\n\\nasync function importCsv(csvFileName) {\\n  const fileContents = await readFile(csvFileName, 'utf8');\\n  const records = await parse(fileContents, { columns: true });\\n  try {\\n    await writeToFirestore(records);\\n  }\\n  catch (e) {\\n    console.error(e);\\n    process.exit(1);\\n  }\\n  console.log(`Wrote ${records.length} records`);\\n}\\n\\nimportCsv(process.argv[2]).catch(e => console.error(e));\\n```\"\n    },\n    {\n      \"id\": \"card-yt-35\",\n      \"title\": \"instalacion-configuracion-raspberry\",\n      \"text\": \"# Cómo instalar Raspbian en Raspberry Pi\\n\\nListado de cosas por instalar en una Raspberry, otras aplicaciones y configuraciones.\\n\\nEn [mi canal de youtube](https://youtu.be/m60_OxnNz5s) hay un video del paso a paso:\\n\\nRaspberry Pi Image\\n```csharp\\nhttps://www.raspberrypi.com/software/\\n```\\n\\nAplicación para saber la ip: \\n```csharp\\nhttps://www.advanced-ip-scanner.com/\\n```\\n\\nInstalar escritorio remoto: \\n```csharp\\nsudo apt update\\nsudo apt upgrade\\nsudo reboot\\nsudo apt install xrdp\\n```\"\n    },\n    {\n      \"id\": \"card-yt-36\",\n      \"title\": \"instalacion-evolution-api\",\n      \"text\": \"# Cómo instalar Evolution-api en Docker Desktop\\n\\n\\nPaso a paso para instalar Evolution-API con un sólo comando.\\n\\nEn [mi canal de youtube](https://youtu.be/rSuEqJ1YvwQ) hay un video del paso a paso:\\n\\n1. Instalar GIT\\n2. Instalar Docker Desktop\\n\\nEjecutar en PowerShell\\n```csharp\\ngit clone https://github.com/codigo8a/evolution-api-script.git\\ncd evolution-api-script\\n& \\\"C:\\\\Program Files\\\\Git\\\\bin\\\\bash.exe\\\"\\n./evolution.sh\\n```\\nUsar la Api Key Global\\n```csharp\\n429683C4C977415CAAFCCE10F7D57E11\\n```\"\n    },\n    {\n      \"id\": \"card-yt-37\",\n      \"title\": \"instalacion-laravel-amazon\",\n      \"text\": \"# Instalación Laravel SSH Servidor UBUNTU\\n\\nA continuación describo linea a linea lo que hay que hacer en la consola SSH para tener en menos de 10 minutos un proyecto Laravel corriendo en un servidor UBUNTU (AWS Amazon Web Services).\\n\\nEn [mi canal de youtube](https://www.youtube.com/watch?v=nExuiPqHkVA) hay un video del paso a paso: \\n\\n```\\nsudo apt-get update\\nsudo apt-get install apache2 -y\\necho $USER \\nsudo nano /etc/apache2/envvars\\nexport APACHE_RUN_USER=ubuntu\\nexport APACHE_RUN_GROUP=ubuntu\\nsudo chown ubuntu:ubuntu /var/www/html -R\\nsudo a2enmod rewrite\\nsudo nano /etc/apache2/sites-available/000-default.conf\\n\\n<Directory \\\"/var/www/html/\\\">\\n        Options Indexes FollowSymLinks\\n        AllowOverride All\\n        Require all granted\\n</Directory>\\n\\nsudo systemctl restart apache2\\nsudo apt-add-repository ppa:ondrej/php\\nsudo apt-get update\\nsudo apt install php7.2 libapache2-mod-php7.2 php7.2-mbstring php7.2-xmlrpc php7.2-soap php7.2-gd php7.2-xml php7.2-cli php7.2-zip zip unzip -y\\nsudo apt-get install git\\ncd /tmp\\nwget https://getcomposer.org/composer.phar\\nsudo mv composer.phar /bin/composer\\nsudo chmod 755 /bin/composer\\ncomposer global require \\\"laravel/installer\\\"\\nsudo nano ~/.profile\\n\\nexport PATH=$PATH:/home/ubuntu/.config/composer/vendor/bin\\n\\nsudo reboot\\ncd /var/www/html/\\nlaravel new aplication-sample\\n\\n//Si no ha configurado la swap\\nfree -m\\nsudo /bin/dd if=/dev/zero of=/var/swap.1 bs=1M count=1024\\nsudo /sbin/mkswap /var/swap.1\\nsudo /sbin/swapon /var/swap.1\\n```\"\n    },\n    {\n      \"id\": \"card-yt-38\",\n      \"title\": \"instalacion-portainer-linux\",\n      \"text\": \"# Cómo instalar docker en Ububtu Server linux\\n\\n\\nPaso a paso para tener docker instalado junto con un administrador visual de contenedores.\\n\\nEn [mi canal de youtube](https://youtu.be/N1C96pBweWY) hay un video del paso a paso:\\n\\nInstalar docker\\n```csharp\\nsudo apt update\\nsudo apt upgrade\\ncurl -sSL https://get.docker.com | sh\\nsudo usermod -aG docker pi\\nsudo reboot\\ndocker version\\n```\\n\\nInstalar Portainer\\n```csharp\\ndocker run -itd -p 8000:8000 -p 9000:9000 --name=portainer --restart=always -v /var/run/docker.sock:/var/run/docker.sock -v /docker/portainer:/data portainer/portainer-ce\\nlocalhost:9000\\ndocker ps\\n```\"\n    },\n    {\n      \"id\": \"card-yt-39\",\n      \"title\": \"instalacion-wiki-dokuwiki\",\n      \"text\": \"# Instalación Sistema Wiki DOKUWIKI\\n\\nA continuación describo linea a linea lo que hay que hacer en la consola SSH para tener en menos de 5 minutos un proyecto de <a target=\\\"_blank\\\" href=\\\"{{ page.dokuwiki }}\\\">documentación WIKI usando DOKUWIKI</a>.\\n\\nEn [mi canal de youtube](https://bit.ly/2wSo5iD) hay un video del paso a paso: \\n\\n```\\ngit clone https://github.com/splitbrain/dokuwiki.git\\nsudo chmod -R 755 /dokuwiki/data/\\n\\n//ejecutar dominio-IP/dokuwiki/install.php\\n```\\n\\n### Mini-tutorial de manejo \\n1. Cómo crear un pagina nueva\\n2. Cómo crear una pagina dentro de una sección\\n3. Cómo activar url amigables\"\n    },\n    {\n      \"id\": \"card-yt-40\",\n      \"title\": \"instalar-windows-store\",\n      \"text\": \"# Cómo instalar tienda de windows Microsoft Store\\n\\n\\nCódigo paso a paso para instalar la tienda de windows \\\"Microsoft Store\\\".\\n\\nEn [mi canal de youtube](https://youtu.be/-wq8jncHdPI) hay un video del paso a paso:\\n \\n1. Abrir Power Shell.\\n\\n2. Ejecutar codigo\\n```csharp\\nGet-AppxPackage -allusers Microsoft.WindowsStore | Foreach {Add-AppxPackage -DisableDevelopmentMode -Register \\\"$($_.InstallLocation)\\\\AppXManifest.xml\\\"}\\n```\"\n    },\n    {\n      \"id\": \"card-yt-41\",\n      \"title\": \"menu-imagenes-joomla\",\n      \"text\": \"# Menú JOOMLA con imagenes\\n\\nCodigo javascript para manejo de menus en joomla con imagenes (Hover y Active)\\n\\nEn [mi canal de youtube](https://youtu.be/2NfTcPnlSpc) hay un video del paso a paso: \\n\\n![ejemplo menu](https://raw.githubusercontent.com/juandavid8a/javascript-menu-images-joomla/master/menu-images.gif)\\n\\nEs un código rápido para poder manejar menus en joomla sólo con imagenes, esta dividido en dos partes:\\n* Revisamos si hay algun item del menu con submenus y los desHabilitamos (si se quiere que aparezcan solo se bede comentar el FOR de los subItem)\\n* Recorre los item que contienen la clase \\\"menu-hover\\\" y revisa si el parent tiene la clase \\\"active\\\", osea que ya se le dio clic a un menú, obtiene la url de la imagen y modifica la etiqueta IMG asignandole una nueva url con la imagen que contiene la terminación \\\"-hover\\\" por defecto\\n* La segunda parte del codigo reacciona al posicionar el mouse sobre cualquier item del menu y busca automaticamente las imagenes con terminacion \\\"-hover\\\" de cada uno y genera el efecto hover.\\n\\n```javascript\\nimageOver=[];\\t\\nvar items = document.getElementsByClassName(\\\"menu-hover\\\");\\nvar subItems = document.getElementsByClassName(\\\"sp-has-child\\\");\\n\\n//Revisamos si hay submenus y los deshabilitamos\\nfor (i = 0; i < subItems.length; i++) {\\n\\tsubItems[i].classList.remove(\\\"sp-has-child\\\");\\n}\\nvar i;\\n//Revisamos si hay algun parent con active y le remplazamos la imagen por el hover\\nfor (i = 0; i < items.length; i++) {\\n\\tif(items[i].parentNode.className.indexOf(\\\"active\\\") > 0){\\n\\t\\tvar img = items[i].firstChild.attributes[\\\"src\\\"].nodeValue;\\n\\t\\timageOver = img.split(\\\".\\\");\\n\\t\\titems[i].firstChild.src=imageOver[0]+'-hover.'+imageOver[1];\\n\\t\\titems[i].classList.remove(\\\"menu-hover\\\");\\n\\t}\\n} \\t\\n//Esperamos a que el mouse pase por un menu y realizamos el efecto hover  \\n$(\\\".menu-hover\\\").hover(function(){\\n\\tvar img = $(this).find('img').attr('src');\\n\\timageOver = img.split(\\\".\\\");\\n\\t$(this).find('img').attr('src', imageOver[0]+'-hover.'+imageOver[1])\\n}, function() {\\n\\t$(this).find('img').attr('src', imageOver[0]+'.'+imageOver[1])\\n});\\n```\\n\\n### Requiere dos imagenes:\\n* nombreDelaImagen.png\\n* nombreDeLaImagen-hover.png\\n\\n### Si es para usar en JOOMLA:\\nPoner clase CSS \\\"menu-hover\\\" en cada menu para que el código sepa sobre cual o cuales menus debe activarse y buscar las imagenes con terminacion \\\"-hover\\\" y generar el efecto.\\n\\n### Si es para usar fuera de JOOMLA esta debe ser la estructura:\\n\\n```html\\n<ul class=\\\"sp-megamenu-parent menu-fade hidden-sm hidden-xs\\\">\\n      <li class=\\\"sp-menu-item current-item active\\\">\\n          <a class=\\\"menu-hover\\\" href=\\\"/web/index.php/nuestra-escencia\\\">\\n            <img src=\\\"/web/images/menu-nuestra-esencia-hover.png\\\" alt=\\\"Nuestra Escencia\\\">\\n          </a>\\n      </li>\\n      <li class=\\\"sp-menu-item\\\">\\n          <a class=\\\"menu-hover\\\" href=\\\"/web/index.php/fresh-perfum\\\">\\n              <img src=\\\"/web/images/menu-tu-esencia.png\\\" alt=\\\"Tu esencia\\\">\\n          </a>\\n      </li>\\n      <li class=\\\"sp-menu-item\\\">\\n          <a class=\\\"\\\" href=\\\"/web/index.php/esencias\\\">\\n              <img src=\\\"/web/images/menu-esencias.png\\\" alt=\\\"Esencias\\\">\\n          </a>\\n      </li>\\n</ul>\\n```\"\n    },\n    {\n      \"id\": \"card-yt-42\",\n      \"title\": \"net-core-clean-arquitecture\",\n      \"text\": \"# Cómo integrar Clean Arquitecture a Net Core 7\\n\\nCodigo paso a paso para integrar Clean Arquitecture a Net Core 7.\\n\\nEn [mi canal de youtube](https://youtu.be/vItyn5jd-k8) hay un video del paso a paso:\\n\\n1 Creamos una Blank Solution\\n\\n2 Agregamos proyecto API .Api\\n- Controllers\\n- Responses\\n  \\n3 Agregamos proyecto Class Library .Core\\n- DTOs\\n- Entities\\n- Enumerations\\n- Interfaces\\n- Exceptions\\n- QueryFilters\\n- Services\\n  \\n4 Agregamos proyecto Class Library .Infrastructure\\n- Data\\n- Repositories\\n- Filters\\n- Mappings\\n- Validators\\n\\n5 Reference\\n- .API = .Core, .Infrastructure\\n- .Infrastructure = .Core\\n\\n6 Ingresamos al appsettings:\\n```csharp\\n,\\n\\\"MongoDbSettings\\\": {\\n  \\\"ConnectionString\\\": \\\"url\\\",\\n  \\\"DatabaseName\\\": \\\"namestring\\\"\\n}\\n```\\n\\n7 Creamos MongoDbSettingsEntity:\\n```csharp\\npublic string ConnectionString { get; set; } = string.Empty;\\npublic string DatabaseName { get; set; } = string.Empty;\\n```\\n\\n8 Instalamos paquetes:\\n```csharp\\nMongoDB.Bson\\nMongoDB.Driver\\nMicrosoft.Extensions.Options\\nAspNetCore.Identity.MongoDbCore\\n```\\n\\n9 Agregamos al program:\\n```csharp\\nbuilder.Services.Configure<MongoDbSettingsEntity>(builder.Configuration.GetSection(nameof(MongoDbSettings)));\\n```\\n\\n10 Creamos el UserEntity:\\n```csharp\\n[BsonIgnoreExtraElements]\\npublic class UserEntity\\n{\\n    [BsonId]\\n    [BsonRepresentation(MongoDB.Bson.BsonType.ObjectId)]\\n    public string Id { get; set; } = string.Empty;\\n    public string Username { get; set; } = string.Empty;\\n    public string Fullmane { get; set; } = string.Empty;\\n    public string Email { get; set; } = string.Empty;\\n}\\n```\\n\\n11 Creamos IUserRepository y IUserService:\\n```csharp\\nTask<List<UserEntity>> GetAll();\\n```\\n\\n12 Creamos IContext:\\n```csharp\\nIMongoCollection<UserEntity> Users { get;  }\\n```\\n\\n13 Creamos Context:\\n```csharp\\npublic class Context : IContext\\n{\\n    private readonly IMongoDatabase _database;\\n    public Context(IOptions<MongoDbSettingsEntity> options)\\n    {\\n        MongoClient _mongoClient = new MongoClient(options.Value.ConnectionString);\\n        _database = _mongoClient.GetDatabase(options.Value.DatabaseName);\\n    }\\n    public IMongoCollection<UserEntity> Users => _database.GetCollection<UserEntity>(\\\"users\\\");\\n}\\n```\\n\\n14 Creamos UserRepository:\\n```csharp\\npublic class UserRepository : IUserRepository\\n{\\n    private readonly IContext _context;\\n    public UserRepository(IContext context)\\n    {\\n        _context = context;\\n    }\\n    public async Task<List<UserEntity>> GetAll() => await _context.Users.Find(_ => true).ToListAsync();\\n}\\n```\\n\\n15 Creamos UserService:\\n```csharp\\npublic class UserService : IUserService\\n{\\n    private readonly IUserRepository _userRepository;\\n    public UserService(IUserRepository userRepository)\\n    {\\n        _userRepository = userRepository;\\n    }\\n    public Task<List<UserEntity>> GetAll()\\n    {\\n        return _userRepository.GetAll();\\n    }\\n}\\n```\\n\\n16 Creamos UserService:\\n```csharp\\npublic class UserService : IUserService\\n{\\n    private readonly IUserRepository _userRepository;\\n    public UserService(IUserRepository userRepository)\\n    {\\n        _userRepository = userRepository;\\n    }\\n    public Task<List<UserEntity>> GetAll()\\n    {\\n        return _userRepository.GetAll();\\n    }\\n}\\n```\\n\\n17 Agregamos al program:\\n```csharp\\nbuilder.Services.AddSingleton<IUserService, UserService>();\\nbuilder.Services.AddSingleton<IUserRepository, UserRepository>();\\n```\\n\\n18 Creo UserController:\\n```csharp\\n[Route(\\\"api/[controller]\\\")]\\n[ApiController]\\npublic class UserController : ControllerBase\\n{\\n    private readonly IUserService _userService;\\n    public UserController(IUserService userService)\\n    {\\n        _userService = userService;\\n    }\\n\\n    // GET: api/<UserController>\\n    [HttpGet]\\n    public async Task<List<UserEntity>> GetAll()\\n    {\\n        return await _userService.GetAll();\\n    }\\n}\\n```\"\n    },\n    {\n      \"id\": \"card-yt-43\",\n      \"title\": \"net-core-mongo-jwt\",\n      \"text\": \"# Cómo usar EntityUser y JWT con MongoDB\\n\\nCodigo paso a paso para integrar EntityUser y JWT con MongoDB.\\n\\nEn [mi canal de youtube](https://youtu.be/f1hoUoB16NI) hay un video del paso a paso:\\n\\nInstalamos paquetes:\\n```csharp\\nAspNetCore.Identity.MongoDbCore\\nMongoDB.Bson\\nMongoDB.Driver\\nMicrosoft.AspNetCore.Authentication.JwtBearer\\n```\\n\\nIngresamos al appsettings:\\n```csharp\\n  ,\\n\\\"MongoDbSettings\\\": {\\n  \\\"ConnectionString\\\": \\\"url\\\",\\n  \\\"DatabaseName\\\": \\\"namestring\\\"\\n}\\n```\\n\\nCreamos ApplicationUser:\\n```csharp\\n[CollectionName(\\\"users\\\")]\\npublic class ApplicationUser : MongoIdentityUser<Guid>\\n{\\n    public string FullName { get; set; } = string.Empty;\\n}\\n```\\n\\nCreamos ApplicationRole:\\n```csharp\\n[CollectionName(\\\"roles\\\")]\\npublic class ApplicationRole : MongoIdentityRole<Guid>\\n{\\n    \\n}\\n```\\n\\nAgregamos a Program.cs:\\n```csharp\\n// Add services to the container.\\nbuilder.Services.Configure<MongoDbSettings>(builder.Configuration.GetSection(nameof(MongoDbSettings)));\\nBsonSerializer.RegisterSerializer(new GuidSerializer(MongoDB.Bson.BsonType.String));\\nBsonSerializer.RegisterSerializer(new DateTimeSerializer(MongoDB.Bson.BsonType.String));\\nBsonSerializer.RegisterSerializer(new DateTimeOffsetSerializer(MongoDB.Bson.BsonType.String));\\n\\n//add mongoIdentityConfiguration...\\nvar mongoDbIdentityConfig = new MongoDbIdentityConfiguration\\n{\\n    MongoDbSettings = builder.Configuration.GetSection(nameof(MongoDbSettings)).Get<MongoDbSettings>(),\\n    IdentityOptionsAction = options =>\\n    {\\n        options.Password.RequireDigit = false;\\n        options.Password.RequiredLength = 8;\\n        options.Password.RequireNonAlphanumeric = true;\\n        options.Password.RequireLowercase = false;\\n\\n        //lockout\\n        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(10);\\n        options.Lockout.MaxFailedAccessAttempts = 5;\\n        options.User.RequireUniqueEmail = true;\\n    }\\n};\\n\\nbuilder.Services.ConfigureMongoDbIdentity<ApplicationUser, ApplicationRole, Guid>(mongoDbIdentityConfig)\\n    .AddUserManager<UserManager<ApplicationUser>>()\\n    .AddSignInManager<SignInManager<ApplicationUser>>()\\n    .AddRoleManager<RoleManager<ApplicationRole>>()\\n    .AddDefaultTokenProviders();\\n\\nbuilder.Services.AddAuthentication(x =>\\n{\\n    x.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;\\n    x.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;\\n}).AddJwtBearer(x =>\\n{\\n    x.RequireHttpsMetadata = true;\\n    x.SaveToken = true;\\n    x.TokenValidationParameters = new TokenValidationParameters\\n    {\\n        ValidateIssuerSigningKey = true,\\n        ValidateIssuer = true,\\n        ValidateAudience = true,\\n        ValidateLifetime = true,\\n        ValidIssuer = \\\"https://localhost:5001\\\",\\n        ValidAudience = \\\"https://localhost:5001\\\",\\n        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(\\\"1swek3u4uo2u4a6e\\\")),\\n        ClockSkew = TimeSpan.Zero\\n    };\\n});\\n\\nbuilder.Services.AddSwaggerGen(setup =>\\n{\\n    // Include 'SecurityScheme' to use JWT Authentication\\n    var jwtSecurityScheme = new OpenApiSecurityScheme\\n    {\\n        BearerFormat = \\\"JWT\\\",\\n        Name = \\\"JWT Authentication\\\",\\n        In = ParameterLocation.Header,\\n        Type = SecuritySchemeType.Http,\\n        Scheme = JwtBearerDefaults.AuthenticationScheme,\\n        Description = \\\"Put **_ONLY_** your JWT Bearer token on textbox below!\\\",\\n\\n        Reference = new OpenApiReference\\n        {\\n            Id = JwtBearerDefaults.AuthenticationScheme,\\n            Type = ReferenceType.SecurityScheme\\n        }\\n    };\\n    setup.AddSecurityDefinition(jwtSecurityScheme.Reference.Id, jwtSecurityScheme);\\n    setup.AddSecurityRequirement(new OpenApiSecurityRequirement\\n    {\\n        { jwtSecurityScheme, Array.Empty<string>() }\\n    });\\n});\\n```\\n\\nCreamos LoginRequest Dto:\\n```csharp\\n[Required, EmailAddress]\\npublic string Email { get; set; } = string.Empty;\\n[Required, DataType(DataType.Password)]\\npublic string Password { get; set; } = string.Empty;\\n```\\n\\nCreamos RegisterRequest Dto:\\n```csharp\\n[Required, EmailAddress]\\npublic string Email { get; set; } = string.Empty;\\npublic string Username { get; set; } = string.Empty;\\n[Required]\\npublic string FullName { get; set; } = string.Empty;\\n\\n[Required, DataType(DataType.Password)]\\npublic string Password { get; set; } = string.Empty;\\n[Required, DataType(DataType.Password), Compare(nameof(Password), ErrorMessage = \\\"Passwords do not match\\\")]\\npublic string ConfirmPassword { get; set; } = string.Empty;\\n```\\n\\nCreamos CreateRoleRequest Dto:\\n```csharp\\npublic string Role { get; set; } = string.Empty;\\n```\\n\\nCreamos LoginResponse Dto:\\n```csharp\\npublic bool Success { get; set; }\\npublic string AccessToken { get; set; } = string.Empty;\\npublic string Email { get; set; } = string.Empty;\\npublic string UserId { get; set; } = string.Empty;\\npublic string Message { get; set; } = string.Empty;\\n```\\n\\nCreamos RegisterResponse Dto:\\n```csharp\\npublic string Message { get; set; } = string.Empty;\\npublic bool Success { get; set; }\\n```\\n\\nCreamos AuthenticationController:\\n```csharp\\n[ApiController]\\n[Route(\\\"api/v1/authenticate\\\")]\\npublic class AuthenticationController : ControllerBase\\n{\\n    private readonly UserManager<ApplicationUser> _userManager;\\n    private readonly RoleManager<ApplicationRole> _roleManager;\\n\\n    public AuthenticationController(UserManager<ApplicationUser> userManager, RoleManager<ApplicationRole> roleManager)\\n    {\\n        _userManager = userManager;\\n        _roleManager = roleManager;\\n    }\\n\\n    [HttpPost]\\n    [Route(\\\"roles/add\\\")]\\n    public async Task<IActionResult> CreateRole([FromBody] CreateRoleRequest request)\\n    {\\n        var appRole = new ApplicationRole { Name = request.Role };\\n        var createRole = await _roleManager.CreateAsync(appRole);\\n        return Ok(new { message = \\\"role created succesfully\\\" });\\n    }\\n\\n    [HttpPost]\\n    [Route(\\\"register\\\")]\\n    public async Task<IActionResult> Register([FromBody] RegisterRequest request)\\n    {\\n        var result = await RegisterAsync(request);\\n        return result.Success ? Ok(result) : BadRequest(result.Message);\\n    }\\n\\n    private async Task<RegisterResponse> RegisterAsync(RegisterRequest request)\\n    {\\n        try\\n        {\\n            var userExists = await _userManager.FindByEmailAsync(request.Email);\\n            if(userExists != null) return new RegisterResponse { Message = \\\"User already exists\\\", Success = false };\\n\\n            //if we get here, no user with this email..\\n\\n            userExists = new ApplicationUser\\n            {\\n                FullName = request.FullName,\\n                Email = request.Email,\\n                ConcurrencyStamp = Guid.NewGuid().ToString(),\\n                UserName = request.Email,\\n\\n            };\\n            var createUserResult = await _userManager.CreateAsync(userExists, request.Password);\\n            if(!createUserResult.Succeeded) return new RegisterResponse { Message = $\\\"Create user failed {createUserResult?.Errors?.First()?.Description}\\\", Success = false };\\n            //user is created...\\n            //then add user to a role...\\n            var addUserToRoleResult = await _userManager.AddToRoleAsync(userExists, \\\"USER\\\");\\n            if(!addUserToRoleResult.Succeeded) return new RegisterResponse { Message = $\\\"Create user succeeded but could not add user to role {addUserToRoleResult?.Errors?.First()?.Description}\\\", Success = false };\\n\\n            //all is still well..\\n            return new RegisterResponse\\n            {\\n                Success = true,\\n                Message = \\\"User registered successfully\\\"\\n            };\\n        }\\n        catch (Exception ex)\\n        {\\n            return new RegisterResponse { Message = ex.Message, Success = false };\\n        }\\n    }\\n\\n    [HttpPost]\\n    [Route(\\\"login\\\")]\\n    [ProducesResponseType((int) HttpStatusCode.OK , Type = typeof(LoginResponse))]\\n    public async Task<IActionResult> Login([FromBody] LoginRequest request)\\n    {\\n        var result = await LoginAsync(request);\\n        return result.Success ? Ok(result) : BadRequest(result.Message);\\n    }\\n\\n    private async Task<LoginResponse> LoginAsync(LoginRequest request)\\n    {\\n        try\\n        {\\n            var user = await _userManager.FindByEmailAsync(request.Email);\\n            if (user is null) return new LoginResponse { Message = \\\"Invalid email/password\\\", Success = false };\\n\\n            //all is well if ew reach here\\n            var claims = new List<Claim>\\n        {\\n            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),\\n            new Claim(ClaimTypes.Name, user.UserName),\\n            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),\\n            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString())\\n        };\\n            var roles = await _userManager.GetRolesAsync(user);\\n            var roleClaims = roles.Select(x => new Claim(ClaimTypes.Role, x));\\n            claims.AddRange(roleClaims);\\n\\n            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(\\\"1swek3u4uo2u4a6e\\\"));\\n            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);\\n            var expires = DateTime.Now.AddMinutes(30);\\n\\n            var token = new JwtSecurityToken(\\n                issuer: \\\"https://localhost:5001\\\",\\n                audience: \\\"https://localhost:5001\\\",\\n                claims: claims,\\n                expires: expires,\\n                signingCredentials: creds\\n                );\\n\\n            return new LoginResponse\\n            {\\n                AccessToken = new JwtSecurityTokenHandler().WriteToken(token),\\n                Message = \\\"Login Successful\\\",\\n                Email = user?.Email,\\n                Success = true,\\n                UserId = user?.Id.ToString()\\n            };\\n        }\\n        catch (Exception ex)\\n        {\\n            Console.WriteLine(ex.Message);\\n            return new LoginResponse { Success = false, Message = ex.Message };\\n        }\\n    }\\n}\\n```\\n\\nAgregamos [Authorize]\"\n    },\n    {\n      \"id\": \"card-yt-44\",\n      \"title\": \"ollama-en-linux-server\",\n      \"text\": \"# Cómo instalar ollama en linux\\n\\n\\nPaso a paso para instalar Ollama en Linux y poder ejectar nuestros propios modelos localmente.\\n\\nEn [mi canal de youtube](https://youtu.be/HJKoVXKV3Oc) hay un video del paso a paso:\\n\\n1. Conectar a la consola (Putty o Cockpit).\\n2. Instalar Ollama (ollama.com).\\n3. Validar instalación.\\n```csharp\\nollama --version\\n```\\n4. Cargar módelo (ollama.com/search).\\n```csharp\\nollama pull <modeloName>\\n```\\n5. Comandos más usados:\\n```csharp\\nollama list\\nollama rm\\nsystemctl status ollama\\n```\\n6. Escuchar toda la red\\n```csharp\\nsudo systemctl edit ollama\\n```\\n```csharp\\n[Service]\\nEnvironment=\\\"OLLAMA_HOST=0.0.0.0\\\"\\n```\\n```csharp\\nsudo systemctl daemon-reload\\nsudo systemctl restart ollama\\n```\"\n    },\n    {\n      \"id\": \"card-yt-45\",\n      \"title\": \"ollama-gratis-con-gpu-de-16gb\",\n      \"text\": \"# Cómo obtener un ollama local con GPU 16GB gratis\\n\\n\\nPaso a paso para correr un ollama local gratuitamente y con acceso a GPU.\\n\\nEn [mi canal de youtube](https://youtu.be/WRT0RgIEXus) hay un video del paso a paso:\\n\\n1. Obtener un APIKEY de Ngrok.\\n2. Ejecuta [setup_and_query_a_ollama_server.ipynb](https://colab.research.google.com/gist/codigo8a/25c30d421e6c8a237ea002face0cb65a/setup_and_query_a_ollama_server.ipynb) en Google Colab\\n3. Configura ollama en Claude Code:\\n```csharp\\n$env:ANTHROPIC_AUTH_TOKEN=\\\"ollama\\\"\\n$env:ANTHROPIC_BASE_URL=\\\"tu-url-de-ngrok\\\"\\n$env:ANTHROPIC_API_KEY=\\\"\\\"\\nclaude --model qwen3-coder\\n```\"\n    },\n    {\n      \"id\": \"card-yt-46\",\n      \"title\": \"pagina-web-github-pages\",\n      \"text\": \"# Cómo crear página web en Github Pages\\n\\n\\nCódigo paso a paso para crear una pagina web usando el hosting gratuito de Github Pages, con dominio personalizado y certificado SSL.\\n\\nEn [mi canal de youtube](https://youtu.be/h9FvfSM9zW8) hay un video del paso a paso:\\n \\n1. Buscar pantilla HTML\\n- Descargar\\n- Descomprimir\\n\\n2. Crear Repositorio\\n- Agregar al nombre del repositorio = .github.io\\n- Vincular repositorio\\n- Subir plantilla\\n\\n3. Configurar dominio\\n- Crear DNS personalizados\\n```csharp\\n185.199.108.153\\n185.199.109.153\\n185.199.110.153\\n185.199.111.153\\n``` \\n- Crear C-NAME\\n- Esperar creación de SSL\"\n    },\n    {\n      \"id\": \"card-yt-47\",\n      \"title\": \"php-mysql-phpmyadmin\",\n      \"text\": \"# Instalación PHP - MYSQL - PHPMYADMIN\\n\\nA continuación describo los comandos de consola SSH para instalar en menos de 5 minutos PHP - MYSQL - PHPMYADMIN en un servidor UBUNTU (AWS Amazon Web Services).\\n\\nEn [mi canal de youtube](https://bit.ly/2wSo5iD) hay un video del paso a paso:\\n\\n```\\nsudo apt-get install apache2 -y\\nsudo apt-get install mysql-server -y\\nsudo mysql_secure_installation ()\\nsudo apt-get install php libapache2-mod-php php-mysql -y\\nsudo service apache2 restart\\n\\nsudo chown root:root -R /var/www/\\nsudo chmod 777 -R /var/www/\\nsudo apt-get install phpmyadmin -y\\nsudo systemctl restart apache2\\nsudo mysql -u root -p \\n\\nCREATE USER 'ubuntu'@'localhost' IDENTIFIED BY 'tu_contrasena';\\nGRANT ALL PRIVILEGES ON * . * TO 'ubuntu'@'localhost';\\nFLUSH PRIVILEGES;\\n\\n//solucionar error al entrar a las tablas\\nsudo cp /usr/share/phpmyadmin/libraries/sql.lib.php /usr/share/phpmyadmin/libraries/sql.lib.php.bak\\nsudo nano /usr/share/phpmyadmin/libraries/sql.lib.php\\n\\n//buscar \\n(count($analyzed_sql_results['select_expr'] == 1)\\n//remplazar por\\n((count($analyzed_sql_results['select_expr']) == 1)\\n```\"\n    },\n    {\n      \"id\": \"card-yt-48\",\n      \"title\": \"problema-cors-laravel-6-2020\",\n      \"text\": \"# Solucionar problema CORS en Laravel 6 | 2020\\n\\nEste tutorial es la actualización de un post anterior que ya no funciona ya que la libreria barryvdh/laravel-cors no esta disponible.\\n\\nA continuación doy una solución rápida al problema Access-Control-Allow-Origin - CORS en Laravel 6 que sucede por razones de seguridad, los exploradores restringen las solicitudes HTTP de origen cruzado iniciadas dentro de un script.\\n\\nEn [mi canal de youtube](https://youtu.be/CDEaBtEeVwM) hay un video del paso a paso:\\n\\nInstalamos\\n```\\ncomposer require fruitcake/laravel-cors\\n```\\n\\nAgregamos esta linea al archivo app/Http/Kernel.php en \\\"protected $middleware\\\"\\n```php\\n\\\\Fruitcake\\\\Cors\\\\HandleCors::class,\\n```\\n\\nCreamos arvhivo de conficuración\\n```php\\nphp artisan vendor:publish --tag=\\\"cors\\\"\\n```\\n\\nAbrimos el archivo de configuracion config/cors.php y agregamos el Path que queremos darle acceso de origenes\\n```php\\n'paths' => ['api/*'],\\n```\"\n    },\n    {\n      \"id\": \"card-yt-49\",\n      \"title\": \"problema-cors-laravel-6\",\n      \"text\": \"# Solucionar problema CORS en Laravel 6 | 2019\\n\\nEste tutorial es la actualización de un post anterior que ya no funciona en versiones nuevas:\\nA continuación doy una solución rápida al problema Access-Control-Allow-Origin - CORS en Laravel 6 que sucede por razones de seguridad, los exploradores restringen las solicitudes HTTP de origen cruzado iniciadas dentro de un script.\\n\\nEn [mi canal de youtube](https://youtu.be/CDEaBtEeVwM) hay un video del paso a paso:\\n\\n```csharp\\n//Instalamos\\ncomposer require barryvdh/laravel-cors\\n\\n//Agregamos esta linea al archivo config/app.php\\n//en el array de providers\\nBarryvdh\\\\Cors\\\\ServiceProvider::class,\\n\\n//Agregamos esta linea al archivo app/Http/Kernel.php\\n//en \\\"protected $middleware\\\"\\n\\\\Barryvdh\\\\Cors\\\\HandleCors::class,\\n\\n//ejecutamos\\nphp artisan vendor:publish --provider=\\\"Barryvdh\\\\Cors\\\\ServiceProvider\\\"\\n```\"\n    },\n    {\n      \"id\": \"card-yt-50\",\n      \"title\": \"problema-cors-laravel\",\n      \"text\": \"# Solucionar problema CORS en Laravel 5\\n\\nA continuación doy una solución rápida al problema Access-Control-Allow-Origin - CORS en Laravel 5 que sucede por razones de seguridad, los exploradores restringen las solicitudes HTTP de origen cruzado iniciadas dentro de un script.\\n\\nEn [mi canal de youtube](https://youtu.be/KvldwGjCg5M) hay un video del paso a paso:\\n\\n```PHP\\n//Creamos un middleware\\n->header('Access-Control-Allow-Origin', '*’)\\n->header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS’);\\n\\n//ingresamos al Kernel\\n'cors' => \\\\App\\\\Http\\\\Middleware\\\\Cors::class,\\n\\n//Agregamos a las rutas\\nRoute::group(['middleware' => 'cors'], function(){\\n    //aqui van todas las rutas que necesitan CORS\\n}); \\n```\"\n    },\n    {\n      \"id\": \"card-yt-51\",\n      \"title\": \"problema-pantalla-negra-obs-studio\",\n      \"text\": \"# Cómo solucionar problema de pantalla negra en OBS studio\\n\\nPaso a paso para solucionar el problema de pantalla negra de la aplicación OBS studio.\\n\\nEn [mi canal de youtube](https://youtu.be/6sUfXk17g8g) hay un video del paso a paso:\\n\\n1. Asegurarse que tiene los Drivers en la ultima versión\\n2. Configurar el panel de control de Nvidia\\n3. Agregrar OBS studio y poner graficos integrados\\n4. Entrar a configuracion de pantalla\\n5. Entrar a configuracion de graficos\\n6. Agregar OBS studio y poner ahorro de energia\"\n    },\n    {\n      \"id\": \"card-yt-52\",\n      \"title\": \"react-error-boundary\",\n      \"text\": \"# Cómo manejar errores en React\\n\\n\\nCódigo paso a paso para agregar un archivo que nos maneje los errores en un Micro-FrontEnd.\\n\\nEn [mi canal de youtube](https://youtu.be/nm8AcpPduV0) hay un video del paso a paso:\\n \\n1 Crear ErrorBoundary.tsx\\n```react\\nimport { Component, ErrorInfo, ReactNode } from \\\"react\\\";\\n\\ninterface ErrorBoundaryState {\\n  hasError: boolean;\\n}\\n\\ninterface ErrorBoundaryProps {\\n  children: ReactNode\\n}\\n\\nclass ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {\\n  constructor(props: ErrorBoundaryProps) {\\n    super(props)\\n    this.state = { hasError: false }\\n  }\\n\\n  static getDerivedStateFromError(error: Error): ErrorBoundaryState {\\n    console.log(\\\"Derived Error\\\", error)\\n    return { hasError: true }\\n  }\\n\\n  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {\\n    console.log('Error: ', error)\\n    console.log('Error Info: ', errorInfo)\\n  }\\n\\n  render() {\\n    if (this.state.hasError) {\\n      return <h1>Oops! RemoteAPP falló</h1>\\n    }\\n\\n    return this.props.children\\n  }\\n}\\n\\nexport default ErrorBoundary;\\n```\\n\\n2 Envolver app\\n```react\\n<ErrorBoundary>\\n  <App />\\n</ErrorBoundary>\\n```\\n\\n3 Error de ejemplo\\n```react\\n  useEffect(() => {\\n      throw new Error('Este es un error generado intencionalmente');\\n  }, []);\\n```\"\n    },\n    {\n      \"id\": \"card-yt-53\",\n      \"title\": \"react-vite-federation\",\n      \"text\": \"# Cómo crear un Micro-FrontEnd React + Vite + Federation\\n\\n\\nCódigo paso a paso para crear dos aplicaciones (remoto y cliente) React + Vite + Federation para Micro-FrontEnd.\\n\\nEn [mi canal de youtube](https://youtu.be/M2o32pzNXI8) hay un video del paso a paso:\\n \\n1 Crear dos proyectos (remoto y cliente)\\n- npm create vite@latest\\n\\n2 Instalar pnpm (PowerShell)\\n```react\\nInvoke-WebRequest https://get.pnpm.io/install.ps1 -UseBasicParsing | Invoke-Expression\\n```\\n\\n3 Instalar federation (cliente y remoto)\\n- pnpm add @originjs/vite-plugin-federation\\n\\n4 Configurar package.json (cliente y remoto)\\n```react\\n\\\"preview\\\": \\\"vite preview --port 5001 --strictPort\\\",\\n\\\"start\\\": \\\"npm run build && npm run preview\\\"\\n```\\n\\n5 Configurar vite.config (remoto)\\n```react\\nimport { defineConfig } from 'vite'\\nimport react from '@vitejs/plugin-react-swc'\\nimport federation from \\\"@originjs/vite-plugin-federation\\\";\\n\\nexport default defineConfig({\\n  plugins: [\\n    react(),\\n    federation({\\n      name: \\\"remote-app\\\",\\n      filename: \\\"remoteEntry.js\\\",\\n      exposes: {\\n        \\\"./remote-app\\\": \\\"./src/main.tsx\\\",\\n      },\\n      shared: [\\\"react\\\", \\\"react-dom\\\"],\\n    }),\\n  ],\\n  build: {\\n    modulePreload: false,\\n    target: \\\"esnext\\\",\\n    minify: false,\\n    cssCodeSplit: false,\\n  },\\n});\\n```\\n\\n6 Configurar main.tsx (remoto)\\n```react\\nconst Main = () => (\\n  <StrictMode>\\n    <App />\\n  </StrictMode>\\n)\\n\\nexport default Main;\\n```\\n\\n7 Configurar vite.config (cliente)  \\n```react\\nimport { defineConfig } from 'vite'\\nimport react from '@vitejs/plugin-react-swc'\\nimport federation from \\\"@originjs/vite-plugin-federation\\\";\\n\\nexport default defineConfig({\\n  plugins: [\\n    react(),\\n    federation({\\n      name: \\\"client-app\\\",\\n      remotes: {\\n        remoteApp: \\\"http://localhost:5001/assets/remoteEntry.js\\\",\\n      },\\n      shared: [\\\"react\\\"],\\n    }),\\n  ],\\n  build: {\\n    modulePreload: false,\\n    target: \\\"esnext\\\",\\n\\n    minify: false,\\n    cssCodeSplit: false,\\n  },\\n});\\n```\\n\\n8 Crear declares.d.ts (cliente)  \\n```react\\ndeclare module 'remoteApp/remote-app' {\\n    export default RemoteApp;\\n}\\n```\\n\\n9 Modificar app remoto  \\n10 Importar app remoto y llamarla cómo un componente  \\n11 npm run start (remoto y cliente)\"\n    },\n    {\n      \"id\": \"card-yt-54\",\n      \"title\": \"renombrar-archivos-en-masa-con-python\",\n      \"text\": \"# Cómo renombrar archivos en masa con Python\\n\\nPaso a paso para renombrar archivos MP3 en masa y poder darle un orden aleatorio para reproducir en un radio vehicular\\n\\nEn [mi canal de youtube](https://youtu.be/6fsG3UX7Cfo) hay un video del paso a paso:\\n\\n```python\\ncont = 1\\nfor i in file_list:\\n        print (\\\"file: \\\"+i)\\n        try:\\n                x = i.split(\\\".\\\")\\n                y = x[0].split(\\\"-\\\")\\n                if len(y) == 1:\\n                    print(\\\">>> no tiene separador \\\\n\\\")\\n                elif len(y) > 2:\\n                    print(\\\">>> tiene más de un separador \\\\n\\\")\\n                else:\\n                    title = y[0].title().strip()\\n                    artist = y[1].title().strip()\\n                    \\n                current = EasyID3(i)\\n                newname = str(cont).zfill(3) + \\\" \\\" + title + \\\" - \\\" + artist + \\\".mp3\\\"\\n                #print(newname)\\n                newname = current[\\\"title\\\"][0] + \\\".mp3\\\"\\n                #newname.replace(\\\" \\\", \\\"_\\\")\\n                del current\\n                print (\\\"renaming \\\"+i+\\\" to \\\"+newname)\\n                os.rename(i, newname)\\n                cont = cont + 1\\n        except:\\n                print (\\\">>> that file didn't work for some reason.\\\")\\n```\"\n    },\n    {\n      \"id\": \"card-yt-55\",\n      \"title\": \"reset-canon-g3100\",\n      \"text\": \"# Reset Impresora Cannon G3100 | 5B00\\n\\nPaso a paso para realizarle un reset a la imprersora Canon G3100 y solucionar el problema de deposito (absorbedor) de tinta lleno.\\n\\nEn <a target=\\\"_blank\\\" href=\\\"https://en.printkita.com/2020/09/download-canon-service-tool-v1050.html\\\">esta web</a> hay un tutorial del paso a paso:\\n\\n1. <div id=\\\"cf-pdf-down\\\">Descargar <a target=\\\"_blank\\\" href=\\\"{{ page.tool }}\\\">aplicación para reseteo</a></div>\\n2. Seguir paso a paso del link.\"\n    },\n    {\n      \"id\": \"card-yt-56\",\n      \"title\": \"roblox-studio-contador-de-balas\",\n      \"text\": \"# Cómo agregar un contador de balas en Roblox Studio\\n\\n\\nCodigo para agregar un contador de balas en Roblox Studio usando el (ACS) Advanced Combat System.\\n\\nEn [mi canal de youtube](https://youtu.be/EbKw0Dcaf6o) hay un video del paso a paso:\\n\\nEditar linea 1511 en StarterPlayer/StarterCharacterScripts/ACS_Client/ACS_Framework\\n```csharp\\n\\tif WeaponData.ShootType == 1 then\\n\\t\\tHUD.FText.Text = Ammo..\\\"/\\\"..StoredAmmo..\\\" | Semi\\\"\\n\\telseif WeaponData.ShootType == 2 then\\n\\t\\tHUD.FText.Text = Ammo..\\\"/\\\"..StoredAmmo..\\\" | Burst\\\"\\n\\telseif WeaponData.ShootType == 3 then\\n\\t\\tHUD.FText.Text = Ammo..\\\"/\\\"..StoredAmmo..\\\" | Auto\\\"\\n\\telseif WeaponData.ShootType == 4 then\\n\\t\\tHUD.FText.Text = Ammo..\\\"/\\\"..StoredAmmo..\\\" | Pump-Action\\\"\\n\\telseif WeaponData.ShootType == 5 then\\n\\t\\tHUD.FText.Text = Ammo..\\\"/\\\"..StoredAmmo..\\\" | Bolt-Action\\\"\\n\\tend\\n```\"\n    },\n    {\n      \"id\": \"card-yt-57\",\n      \"title\": \"sistema-grafico-linux\",\n      \"text\": \"# Cómo instalar sistema gráfico Linux\\n\\nPaso a paso para instalar un sistema grafico liviano a Linux server.\\n\\nEn [mi canal de youtube](https://youtu.be/bZnSi0pwkxI) hay un video del paso a paso:\\n\\n1. Descargar\\n```csharp\\nsudo apt update && sudo apt upgrade -y\\nsudo apt install xfce4 xfce4-goodies -y\\n```\\n2. Sistema de inicio de session\\n```csharp\\nsudo apt install slim -y\\necho \\\"startxfce4\\\" > ~/.xsession\\n```\\n3. Escritorio remoto\\n```csharp\\nsudo apt install xrdp -y\\nsudo systemctl restart xrdp\\nsudo systemctl enable xrdp\\n```\"\n    },\n    {\n      \"id\": \"card-yt-58\",\n      \"title\": \"vite-jest-typescript-app\",\n      \"text\": \"# Cómo crear y configurar prueba unitaria Jest en React con Vite y Typescript\\n\\nPaso a paso para crear una prueba unitaria basica con Jest en React con Vite y Typescript.\\n\\nEn [mi canal de youtube](https://youtu.be/62yuvCMZHco) hay un video del paso a paso:\\n\\n```react\\nyarn add --dev jest babel-jest @babel/preset-env @babel/preset-react \\nyarn add --dev @testing-library/react @testing-library/dom @testing-library/user-event @types/jest jest-environment-jsdom\\nyarn add --dev jest-svg-transformer\\npnpm i --save-dev @babel/core @babel/preset-typescript\\npnpm i --save-dev identity-obj-proxy\\n```\\npackage.json\\n```react\\n\\\"test\\\": \\\"jest --watchAll=false --coverage --CI=true\\\"\\n```\\n\\nbabel.config.js \\n```react\\nmodule.exports = {\\n    presets: [\\n        [ '@babel/preset-env', { targets: { esmodules: true } } ],\\n        [ '@babel/preset-react', { runtime: 'automatic' } ],\\n        '@babel/preset-typescript',\\n    ],\\n};\\n```\\n\\njest.config.js\\n```react\\nmodule.exports = {\\n    testEnvironment: 'jest-environment-jsdom',\\n    setupFiles: ['./jest.setup.js'],\\n    moduleNameMapper: {\\n        \\\"^.+\\\\\\\\.svg$\\\": \\\"jest-svg-transformer\\\",\\n\\t\\\"\\\\\\\\.(css|less|scss)$\\\": \\\"identity-obj-proxy\\\",\\n  }\\n}\\n```\\njest.setup.js\\n\\nApp.test.tsx\\n```react\\nimport { render, screen } from '@testing-library/react';\\nimport App from '../App';\\n\\ntest('Renders main page correctly', async () => {\\n  render(<App />);\\n  const buttonCount = await screen.findByRole('button');\\n  expect(buttonCount.innerHTML).toBe('count is 0');\\n  expect(true).toBeTruthy();\\n});\\n```\"\n    },\n    {\n      \"id\": \"card-yt-59\",\n      \"title\": \"vscode-server\",\n      \"text\": \"# Cómo instalar VS Code en Linux\\n\\n\\nPaso a paso para instalar VS Code en Linux server y poder acceder a el desde cualquier parte por medio de una url.\\n\\nEn [mi canal de youtube](https://youtu.be/kN0RcPp5W7Y) hay un video del paso a paso:\\n\\n1. Descargar y ejecutar\\n```csharp\\ncurl -fsSL https://code-server.dev/install.sh | sh\\n```\\n2. Revisar version.\\n```csharp\\ncode-server --version\\n```\\n3. Ejecutar desde cualquier ip:\\n```csharp\\nnano .config/code-server/config.yaml\\nbind-addr: 0.0.0.0:8080\\n```\\n4. Activar servicio\\n```csharp\\nsudo systemctl enable code-server@$USER\\nsudo systemctl start code-server@$USER\\nsudo systemctl status code-server@$USER\\n```\\n5. Saber contraseña\\n```csharp\\ncat ~/.config/code-server/config.yaml\\n```\\n6. Ejecutar ip con puerto\\n```csharp\\nhttp://IP_DEL_SERVIDOR:8080\\n```\"\n    }\n  ]\n}",
  );
  file(
    "C:\\AUTOEXEC.BAT",
    `@ECHO OFF\nPROMPT $P$G\nPATH C:\\WINDOWS;C:\\DOS\nSET TEMP=C:\\TEMP\nREM Configuration example. Native DOS commands are not executed by this desktop.\n`,
  );
  file(
    "C:\\CONFIG.SYS",
    `REM Windows 3.1 configuration example\nFILES=40\nBUFFERS=20\nDOS=HIGH,UMB\nLASTDRIVE=C\n`,
  );
  file(
    "C:\\WINDOWS\\WIN.INI",
    `[windows]\nload=\nrun=\nNullPort=None\n\n[desktop]\nWallpaper=(None)\nTileWallpaper=0\nPattern=(None)\n\n[extensions]\ntxt=notepad.exe ^.txt\nwri=write.exe ^.wri\nbmp=pbrush.exe ^.bmp\n\n[fonts]\n; Fonts are supplied by the browser desktop.\n`,
  );
  file(
    "C:\\WINDOWS\\SYSTEM.INI",
    `[boot]\nshell=progman.exe\n\n[386Enh]\n; Browser recreation: these settings are readable examples.\n; Editing this file does not alter the host computer.\n`,
  );
  file(
    "C:\\WINDOWS\\CONTROL.INI",
    `[Patterns]\n(None)=0 0 0 0 0 0 0 0\nGray=85 170 85 170 85 170 85 170\nBricks=255 128 128 128 255 8 8 8\n\n[Current]\nColor Schemes=Windows Standard\n`,
  );
  file(
    "C:\\WINDOWS\\PROGMAN.INI",
    `[Settings]\nAutoArrange=0\nMinOnRun=0\nSaveSettings=1\n\n[Groups]\nGroup1=Main\nGroup2=Accessories\nGroup3=Games\n`,
  );
  file(
    "C:\\WINDOWS\\README.TXT",
    `WINDOWS CONFIGURATION FILES\n\nThe INI, BAT, and SYS files in this virtual disk are editable configuration examples. Desktop preferences are applied through Control Panel and stored separately by the browser application.\n\nNo file in this disk changes the host operating system. Programs are implemented as browser applications. This is not a native x86 emulator.\n`,
  );
  file(
    "C:\\WINDOWS\\SYSTEM\\README.TXT",
    `SYSTEM DIRECTORY\n\nThe original Windows 3.1 stored device drivers and shared libraries here. This browser desktop uses WebGPU, WebGL, or Canvas for the desktop background and standard browser interfaces for its applications.\n\nThere are no executable placeholder drivers in this directory.\n`,
  );
  return { version: VERSION, entries };
}

/** A deterministic, dependency-free persistence adapter, useful for embedding and tests. */
export class MemoryDiskStorage {
  constructor(snapshot = null) {
    this.backend = "memory";
    this.value = snapshot ? cloneJSON(snapshot) : null;
  }
  async load() {
    return this.value ? cloneJSON(this.value) : null;
  }
  async save(snapshot) {
    this.value = cloneJSON(snapshot);
  }
  close() {}
}

/** IndexedDB snapshot storage with localStorage failover and explicit error reporting. */
export class BrowserDiskStorage {
  constructor(options = {}) {
    this.databaseName = options.databaseName ?? "win31-browser-disk";
    this.key = options.key ?? "drive-c";
    this.fallbackKey = options.fallbackKey ?? "win31:disk:v1";
    this.backend = "loading";
    this.lastError = null;
    this.warning = null;
    this._onError = options.onError;
    this._sequence = 0;
    this._closed = false;
    if (own(options, "indexedDB")) this._indexedDB = options.indexedDB;
    else {
      try {
        this._indexedDB = globalThis.indexedDB;
      } catch (error) {
        this.warning = error;
      }
    }
    if (own(options, "localStorage")) this._localStorage = options.localStorage;
    else {
      try {
        this._localStorage = globalThis.localStorage;
      } catch (error) {
        this.warning = error;
      }
    }
  }

  async load() {
    let primary = null;
    let fallback = null;
    let primaryOK = false;
    let fallbackOK = false;
    let primaryError;
    let fallbackError;
    if (this._localStorage) {
      try {
        const raw = this._localStorage.getItem(this.fallbackKey);
        fallback = raw == null ? null : this._decode(JSON.parse(raw));
        fallbackOK = true;
      } catch (error) {
        fallbackError = error;
      }
    }
    if (this._indexedDB) {
      try {
        primary = this._decode(await this._readIndexed());
        primaryOK = true;
      } catch (error) {
        primaryError = error;
      }
    }
    // A store that could not be read must not be overwritten later in this session.
    this._primaryReadable = primaryOK;
    const corrupt = [primaryError, fallbackError].find(
      (error) => error?.code === "EBADSNAPSHOT" || error instanceof SyntaxError,
    );
    if (corrupt && !primary && !fallback) {
      this.backend = primaryOK
        ? "indexeddb"
        : fallbackOK
          ? "localStorage"
          : "memory";
      this._report(corrupt, false);
      throw corrupt;
    }
    if (!primaryOK && !fallbackOK) {
      this.backend = "memory";
      const error =
        primaryError ??
        fallbackError ??
        new Error("Persistent browser storage is unavailable.");
      this._report(error, false);
      // Failure to read an existing store must not silently replace its data.
      if (primaryError || fallbackError) throw error;
      return null;
    }
    this.backend = primaryOK ? "indexeddb" : "localStorage";
    if (primaryError || fallbackError)
      this._report(primaryError ?? fallbackError, true);
    const latest = !primary
      ? fallback
      : !fallback
        ? primary
        : fallback.updatedAt > primary.updatedAt ||
            (fallback.updatedAt === primary.updatedAt &&
              fallback.sequence > primary.sequence)
          ? fallback
          : primary;
    this._sequence = latest?.sequence ?? 0;
    return latest?.snapshot ?? null;
  }

  async save(snapshot) {
    if (this._closed) throw new Error("The virtual disk has been closed.");
    const record = {
      format: "win31-disk",
      version: 1,
      sequence: ++this._sequence,
      updatedAt: Date.now(),
      snapshot,
    };
    let primaryError;
    if (this._indexedDB && this._primaryReadable !== false) {
      try {
        await this._writeIndexed(record);
        this.backend = "indexeddb";
        this.lastError = null;
        return;
      } catch (error) {
        primaryError = error;
      }
    }
    if (this._localStorage) {
      try {
        this._localStorage.setItem(this.fallbackKey, JSON.stringify(record));
        this.backend = "localStorage";
        this.lastError = null;
        if (primaryError) this._report(primaryError, true);
        return;
      } catch (error) {
        this.backend = "memory";
        this._report(error, false);
        throw error;
      }
    }
    this.backend = "memory";
    const error =
      primaryError ?? new Error("Persistent browser storage is unavailable.");
    this._report(error, false);
    throw error;
  }

  _decode(record) {
    if (record == null) return null;
    if (
      record.format === "win31-disk" &&
      record.version === 1 &&
      Number.isSafeInteger(record.sequence) &&
      record.sequence >= 0 &&
      Number.isFinite(record.updatedAt) &&
      record.updatedAt >= 0 &&
      record.snapshot
    ) {
      validateSnapshot(record.snapshot);
      return record;
    }
    // The public snapshot format is also accepted for a previous direct-snapshot save.
    if (record.version === VERSION && Array.isArray(record.entries)) {
      validateSnapshot(record);
      return { snapshot: record, sequence: 0, updatedAt: 0 };
    }
    throw new FileSystemError(
      "EBADSNAPSHOT",
      "The saved disk has an invalid format.",
    );
  }

  _open() {
    if (this._closed)
      return Promise.reject(new Error("The virtual disk has been closed."));
    if (this._database) return Promise.resolve(this._database);
    if (this._opening) return this._opening;
    this._opening = new Promise((resolve, reject) => {
      let settled = false;
      let request;
      const finish = (error, database) => {
        if (settled) {
          database?.close();
          return;
        }
        settled = true;
        clearTimeout(timeout);
        if (error) reject(error);
        else {
          this._database = database;
          database.onversionchange = () => {
            database.close();
            this._database = null;
            this._opening = null;
          };
          resolve(database);
        }
      };
      const timeout = setTimeout(
        () => finish(new Error("Opening the virtual disk timed out.")),
        4000,
      );
      try {
        request = this._indexedDB.open(this.databaseName, 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains("snapshots"))
            database.createObjectStore("snapshots");
        };
        request.onsuccess = () => finish(null, request.result);
        request.onerror = () =>
          finish(
            request.error ?? new Error("The virtual disk could not be opened."),
          );
        request.onblocked = () =>
          finish(new Error("Another tab is blocking the virtual disk."));
      } catch (error) {
        finish(error);
      }
    }).catch((error) => {
      this._opening = null;
      throw error;
    });
    return this._opening;
  }

  async _readIndexed() {
    const database = await this._open();
    return new Promise((resolve, reject) => {
      let value = null;
      const transaction = database.transaction("snapshots", "readonly");
      const request = transaction.objectStore("snapshots").get(this.key);
      request.onsuccess = () => {
        value = request.result ?? null;
      };
      transaction.oncomplete = () => resolve(value);
      transaction.onabort = () =>
        reject(
          transaction.error ??
            request.error ??
            new Error("The disk read was aborted."),
        );
      transaction.onerror = () => {
        /* onabort provides the transaction's final result. */
      };
    });
  }

  async _writeIndexed(record) {
    const database = await this._open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction("snapshots", "readwrite");
      const request = transaction
        .objectStore("snapshots")
        .put(record, this.key);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(
          transaction.error ??
            request.error ??
            new Error("The disk write was aborted."),
        );
      transaction.onerror = () => {
        /* onabort provides the transaction's final result. */
      };
    });
  }

  _report(error, recovered) {
    if (recovered) this.warning = error;
    else this.lastError = error;
    try {
      this._onError?.(error, { recovered, backend: this.backend });
    } catch {
      /* Application callback. */
    }
  }

  close() {
    this._closed = true;
    this._database?.close();
    this._database = null;
  }
}

/**
 * Synchronous case-insensitive virtual C: drive. Await ready before exposing file actions.
 * Each mutation commits atomically in memory; durable writes are serialized separately.
 */
export class VirtualFileSystem {
  constructor(options = {}) {
    this._clock = options.clock ?? (() => new Date());
    this._listeners = new Set();
    this._journal = [];
    this._revision = 0;
    this._savedRevision = -1;
    this._readyComplete = false;
    this._closed = false;
    this._blocked = false;
    this._lastPersistError = null;
    this._onStorageError = options.onStorageError;
    this._entries = validateSnapshot(
      options.seed === false
        ? {
            version: VERSION,
            entries: [{ path: ROOT, type: "directory", modified: this._now() }],
          }
        : options.seed && typeof options.seed === "object"
          ? options.seed
          : createSeedSnapshot(),
    );
    if (own(options, "storage"))
      this._storage = options.storage ?? new MemoryDiskStorage();
    else if (
      typeof window === "undefined" &&
      !own(options, "indexedDB") &&
      !own(options, "localStorage")
    )
      this._storage = new MemoryDiskStorage();
    else
      this._storage = new BrowserDiskStorage({
        ...options,
        onError: (error, details) => this._storageWarning(error, details),
      });
    if (
      typeof this._storage.load !== "function" ||
      typeof this._storage.save !== "function"
    ) {
      throw new TypeError(
        "Disk storage must provide load() and save(snapshot).",
      );
    }
    this.persistence = {
      backend: this._storage.backend ?? "custom",
      status: "loading",
      lastError: null,
      warning: null,
      savedRevision: -1,
    };
    this.ready = this._initialize();
  }

  normalize(path, cwd = ROOT) {
    return normalizePath(path, cwd);
  }
  parent(path) {
    return parentOf(this.normalize(path));
  }
  basename(path) {
    return basenameOf(this.normalize(path));
  }

  exists(path) {
    return this._entries.has(this.normalize(path));
  }

  stat(path) {
    path = this.normalize(path);
    return info(path, requireEntry(this._entries, path));
  }

  readdir(path = ROOT) {
    path = this.normalize(path);
    requireDirectory(this._entries, path);
    return [...this._entries]
      .filter(([child]) => child !== path && parentOf(child) === path)
      .map(([child, entry]) => info(child, entry))
      .sort((a, b) =>
        a.type === b.type
          ? a.name.localeCompare(b.name)
          : a.type === "directory"
            ? -1
            : 1,
      );
  }

  readFile(path) {
    path = this.normalize(path);
    const entry = requireEntry(this._entries, path);
    if (entry.type !== "file") fail("EISDIR", "The path is a directory", path);
    return entry.content;
  }

  writeFile(path, content) {
    path = this.normalize(path);
    if (typeof content !== "string")
      fail("EINVAL", "File content must be text", path);
    const timestamp = this._now();
    this._mutate("write", { path }, (entries) => {
      requireDirectory(entries, parentOf(path));
      const previous = entries.get(path);
      if (previous?.type === "directory")
        fail("EISDIR", "The path is a directory", path);
      if (previous?.content === content) return false;
      entries.set(path, {
        type: "file",
        content,
        created: previous?.created ?? timestamp,
        modified: timestamp,
      });
      touchParent(entries, path, timestamp);
      return true;
    });
    return path;
  }

  mkdir(path, options = {}) {
    path = this.normalize(path);
    const timestamp = this._now();
    this._mutate("mkdir", { path }, (entries, replay) => {
      const existing = entries.get(path);
      if (existing) {
        if (existing.type === "directory" && (options.recursive || replay))
          return false;
        fail("EEXIST", "The path already exists", path);
      }
      const missing = [];
      let current = path;
      while (!entries.has(current)) {
        missing.unshift(current);
        current = parentOf(current);
      }
      requireDirectory(entries, current);
      if (!options.recursive && missing.length > 1)
        fail("ENOENT", "The parent directory does not exist", parentOf(path));
      for (const directory of missing) {
        entries.set(directory, {
          type: "directory",
          created: timestamp,
          modified: timestamp,
        });
        touchParent(entries, directory, timestamp);
      }
      return true;
    });
    return path;
  }

  remove(path, options = {}) {
    path = this.normalize(path);
    if (path === ROOT)
      fail("EPERM", "The root directory cannot be removed", path);
    const timestamp = this._now();
    this._mutate("remove", { path }, (entries, replay) => {
      if (replay && !entries.has(path)) return false;
      const entry = requireEntry(entries, path);
      const descendants = [...entries.keys()].filter((child) =>
        beneath(child, path),
      );
      if (
        entry.type === "directory" &&
        descendants.length &&
        !options.recursive
      ) {
        fail("ENOTEMPTY", "The directory is not empty", path);
      }
      for (const child of descendants) entries.delete(child);
      entries.delete(path);
      touchParent(entries, path, timestamp);
      return true;
    });
  }

  copy(source, destination, options = {}) {
    return this._transfer(source, destination, options, false);
  }
  rename(source, destination, options = {}) {
    return this._transfer(source, destination, options, true);
  }
  move(source, destination, options = {}) {
    return this.rename(source, destination, options);
  }

  _transfer(source, destination, options, move) {
    source = this.normalize(source);
    destination = this.normalize(destination);
    if (source === ROOT || destination === ROOT)
      fail(
        "EPERM",
        "The root directory cannot be replaced or relocated",
        source,
      );
    const timestamp = this._now();
    this._mutate(
      move ? "rename" : "copy",
      { path: destination, source, destination },
      (entries) => {
        requireEntry(entries, source);
        if (source === destination) {
          if (move) return false;
          fail("EINVAL", "A file cannot be copied onto itself", source);
        }
        if (beneath(destination, source) || beneath(source, destination)) {
          fail("EINVAL", "Source and destination trees overlap", destination);
        }
        requireDirectory(entries, parentOf(destination));
        if (entries.has(destination) && !options.overwrite)
          fail("EEXIST", "The destination already exists", destination);
        const copied = [...entries].filter(
          ([path]) => path === source || beneath(path, source),
        );
        if (options.overwrite) {
          for (const path of entries.keys())
            if (path === destination || beneath(path, destination))
              entries.delete(path);
        }
        for (const [path, entry] of copied) {
          entries.set(destination + path.slice(source.length), {
            ...entry,
            created: move ? entry.created : timestamp,
          });
        }
        if (move) {
          for (const [path] of copied) entries.delete(path);
          touchParent(entries, source, timestamp);
        }
        touchParent(entries, destination, timestamp);
        return true;
      },
    );
    return destination;
  }

  snapshot() {
    return snapshotOf(this._entries);
  }

  restore(snapshot) {
    const validated = validateSnapshot(snapshot);
    this._ensureOpen();
    this._entries = validated;
    this._revision += 1;
    this._blocked = false;
    this._lastPersistError = null;
    if (!this._readyComplete)
      this._journal.push({ replacement: snapshotOf(validated) });
    this._emit({ type: "restore", path: ROOT, revision: this._revision });
    this._schedulePersist();
  }

  subscribe(listener) {
    if (typeof listener !== "function")
      throw new TypeError("A listener is required.");
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /** Resolves after all current revisions have been durably saved; rejects on failure. */
  async flush() {
    await this.ready;
    if (this._blocked)
      throw (
        this._lastPersistError ??
        new Error("Disk persistence is blocked after a load error.")
      );
    if (this._closed) return;
    await this._startPersist();
  }

  /** Await before leaving an embedding context when possible. */
  async dispose() {
    let error;
    try {
      await this.flush();
    } catch (caught) {
      error = caught;
    }
    this._closed = true;
    this._storage.close?.();
    this._listeners.clear();
    if (error) throw error;
  }

  _now() {
    const date = this._clock();
    const result = date instanceof Date ? date : new Date(date);
    if (!Number.isFinite(result.getTime()))
      throw new TypeError("The filesystem clock must return a valid date.");
    return result.toISOString();
  }

  _ensureOpen() {
    if (this._closed) fail("ECLOSED", "The virtual disk has been closed");
  }

  _mutate(type, details, operation) {
    this._ensureOpen();
    const entries = new Map(this._entries);
    if (!operation(entries, false)) return;
    this._entries = entries;
    this._revision += 1;
    if (!this._readyComplete) this._journal.push({ operation });
    this._emit({ type, ...details, revision: this._revision });
    this._schedulePersist();
  }

  async _initialize() {
    try {
      const stored = await this._storage.load();
      if (stored) {
        let loaded = validateSnapshot(stored);
        for (const entry of this._journal) {
          if (entry.replacement) loaded = validateSnapshot(entry.replacement);
          else {
            const draft = new Map(loaded);
            entry.operation(draft, true);
            loaded = draft;
          }
        }
        this._entries = loaded;
      }
      this._savedRevision =
        stored && !this._journal.length ? this._revision : -1;
      this.persistence.backend = this._storage.backend ?? "custom";
      this.persistence.status =
        this._savedRevision === this._revision ? "saved" : "pending";
      this.persistence.savedRevision = this._savedRevision;
    } catch (error) {
      this._blocked = true;
      this._lastPersistError = error;
      this._persistenceError(error);
    }
    this._journal = [];
    this._readyComplete = true;
    this._emit({ type: "ready", path: ROOT, revision: this._revision });
    this._schedulePersist();
    return this;
  }

  _schedulePersist() {
    if (
      !this._readyComplete ||
      this._blocked ||
      this._closed ||
      this._saveScheduled
    )
      return;
    this._saveScheduled = true;
    queueMicrotask(() => {
      this._saveScheduled = false;
      this._startPersist().catch(() => {
        /* The error is exposed through persistence and flush(). */
      });
    });
  }

  _startPersist() {
    if (this._saving) return this._saving;
    if (this._savedRevision === this._revision || this._closed)
      return Promise.resolve();
    if (this._blocked) return Promise.reject(this._lastPersistError);
    this._saving = (async () => {
      while (this._savedRevision !== this._revision && !this._closed) {
        const revision = this._revision;
        const snapshot = this.snapshot();
        this.persistence.status = "saving";
        this._emit({ type: "persistence", ...this.persistence });
        try {
          await this._storage.save(snapshot);
          this._savedRevision = revision;
          this._lastPersistError = null;
          Object.assign(this.persistence, {
            backend: this._storage.backend ?? "custom",
            status: "saved",
            lastError: null,
            savedRevision: revision,
          });
          this._emit({ type: "persistence", ...this.persistence });
        } catch (error) {
          this._lastPersistError = error;
          this._persistenceError(error);
          throw error;
        }
      }
    })().finally(() => {
      this._saving = null;
      if (!this._lastPersistError && this._savedRevision !== this._revision)
        this._schedulePersist();
    });
    return this._saving;
  }

  _storageWarning(error, details) {
    if (this.persistence) this.persistence.warning = error;
    try {
      this._onStorageError?.(error, details);
    } catch {
      /* Application callback. */
    }
  }

  _persistenceError(error) {
    Object.assign(this.persistence, {
      backend: this._storage.backend ?? "custom",
      status: "error",
      lastError: error,
    });
    this._emit({ type: "persistence", ...this.persistence });
    try {
      this._onStorageError?.(error, {
        recovered: false,
        backend: this.persistence.backend,
      });
    } catch {
      /* Application callback. */
    }
  }

  _emit(event) {
    for (const listener of [...this._listeners]) {
      try {
        listener(event);
      } catch {
        /* Subscribers cannot roll back a committed transaction. */
      }
    }
  }
}

export default VirtualFileSystem;
