# Windows 3.1 historical references and font attribution

This browser recreation follows the English base edition of Microsoft Windows 3.1 released in 1992. The sources below document its application inventory and visual conventions. Windows for Workgroups, Windows NT, and Windows 95 have related interfaces but different bundled applications and shell behavior.

## Historical sources

### Default groups and applications

Microsoft Knowledge Base article [Q84773, Default Program and Group Icons Added During Windows 3.1 Setup](https://jeffpar.github.io/kbarchive/kb/084/Q84773/), lists the following Windows 3.1 defaults separately from Windows 3.0:

| Group | Default items, in Microsoft's listed order |
|---|---|
| Main | File Manager; Control Panel; Print Manager; Clipboard; MS-DOS Prompt; Windows Setup; PIF Editor; Read Me |
| Accessories | Write; Paintbrush; Terminal; Notepad; Recorder; Cardfile; Calendar; Calculator; Clock; Object Packager; Character Map; Media Player; Sound Recorder |
| Games | Solitaire; Minesweeper |
| StartUp | Empty initially |

An Applications group can reflect applications detected during Setup. The four groups above are the explicit default groups in Q84773. The original names include **Clipboard**, **Write**, and **Paintbrush**. Reversi appears in the Windows 3.0 list; Minesweeper appears in the Windows 3.1 list.

### System typography

The **Microsoft Windows 3.1 Resource Kit**, printed page 144, describes the **System** proportional raster font used for system text. It lists VGASYS.FON for 640 by 480 VGA, EGASYS.FON for EGA, and 8514SYS.FON for the 1024 by 768 display mode.

- [Resource Kit scan](https://msdos-windows.com/index_html_files/Microsoft%20Windows%203.1%20Resource%20Kit%201992.pdf)
- [Alternative scan at Bitsavers](https://www.bitsavers.org/pdf/microsoft/resource_kits/0030-31645_Windows_3.1_Resource_Kit_199202.pdf)

Microsoft KB [Q80153, How to Change Windows System Font](https://ftp.zx.net.nz/pub/archive/ftp.microsoft.com/MISC/KB/en-us/80/153.HTM), confirms that the system font affects menus, title bars, and dialogs.

Icon captions use separate settings. Microsoft KB [Q84169, Changing the Icon Title Size/Font for Windows 3.1](https://jeffpar.github.io/kbarchive/kb/084/Q84169/), gives these defaults:

| Setting | Default |
|---|---|
| IconTitleFaceName | MS Sans Serif |
| IconTitleSize | 8 points |
| IconTitleStyle | 0, regular weight |

The recreation uses regular 11px icon captions and a 13px base UI font. Its bold MS Sans Serif recreation approximates the heavier System face; it is not an exact copy of VGASYS.FON.

### Spacing and window frames

The Resource Kit's WIN.INI documentation specifies **IconSpacing=77** and **BorderWidth=3** as defaults. Microsoft KB [Q83433, Windows 3.1 Resource Kit WIN.INI Section Settings](https://jeffpar.github.io/kbarchive/kb/083/Q83433/), reproduces that documentation. An [alternative archive](https://www.infania.net/misc/kbarchive/kb/083/Q83433/index.html) is also available.

## Visual conventions and fidelity

The shell reproduces the central Windows 3.1 conventions: Program Manager with overlapping group windows, centered captions, a system-menu box at the left, and up/down triangle controls for maximizing and minimizing. Menu bars and group interiors follow the standard white appearance; the desktop, window frames, and button surfaces use gray. Minimized groups stay inside Program Manager, while minimized applications appear as desktop icons.

Historical screenshots are useful for these relationships and proportions. The [Windows history article at 3DJuegos PC](https://www.3djuegospc.com/sistema-operativo/esta-historia-windows-1985-w11-como-sistema-operativo-microsoft-ha-evolucionado-anos) includes a [Program Manager screenshot](https://i.blogs.es/2eef22/windows-4/1366_2000.jpeg). It is a resized image and includes an installed Office toolbar and group, so it should not be treated as a native-resolution measurement or an inventory of base Windows features.

This is a browser implementation with independently drawn SVG app icons. Browser font rasterization, display scaling, responsive layouts, and recreated app controls can differ from the original operating system. The 32px icon slots and bitmap-style fonts preserve the period's visual character without claiming an exact pixel match at every browser zoom level or viewport size.

## Included fonts and attribution

**MS Sans Serif and MS Sans Serif Bold recreations by lou, licensed under Creative Commons Attribution ShareAlike 3.0; WOFF2 conversions distributed by 98.css.**

The font files are `ms_sans_serif.woff2` and `ms_sans_serif_bold.woff2`. Their accompanying license and readme notices are included with the fonts. The normal-font readme identifies 11 as its intended pixel size. Separate normal and bold font faces are used.

Original creator pages:

- [MS Sans Serif by lou](https://fontstruct.com/fontstructions/show/1384746)
- [MS Sans Serif Bold by lou](https://fontstruct.com/fontstructions/show/1384862)

Font distribution and notices:

- [Normal WOFF2 in 98.css](https://raw.githubusercontent.com/jdan/98.css/main/fonts/converted/ms_sans_serif.woff2)
- [Bold WOFF2 in 98.css](https://raw.githubusercontent.com/jdan/98.css/main/fonts/converted/ms_sans_serif_bold.woff2)
- [Normal-font license](https://raw.githubusercontent.com/jdan/98.css/main/fonts/src/ms-sans-serif/license.txt)
- [Bold-font license](https://raw.githubusercontent.com/jdan/98.css/main/fonts/src/ms-sans-serif-bold/license.txt)
- [Normal-font readme](https://raw.githubusercontent.com/jdan/98.css/main/fonts/src/ms-sans-serif/readme.txt)
- [Bold-font readme](https://raw.githubusercontent.com/jdan/98.css/main/fonts/src/ms-sans-serif-bold/readme.txt)
- [Creative Commons Attribution ShareAlike 3.0](https://creativecommons.org/licenses/by-sa/3.0/)

The fonts have their own CC BY-SA 3.0 license. The MIT license of the surrounding 98.css project does not replace those font notices. Redistributions of the fonts must retain their attribution and applicable license information.
