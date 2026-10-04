import { el, button } from "../core/dom.js";
import { evaluate, formatNumber, factorial } from "./math.js";
import { helpMenu, listen } from "./common.js";

export function registerCalculator(os) {
  os.registerApp({
    id: "calculator",
    title: "Calculator",
    icon: "calculator",
    width: 435,
    height: 465,
    minWidth: 290,
    minHeight: 315,
    singleton: true,
    create(ctx) {
      ctx.content.classList.add("calc-app");
      let scientific = !!os.storage.get("calculator-scientific", false),
        base = 10,
        angle = "deg",
        inverse = false,
        hyperbolic = false;
      let entry = "0",
        tokens = [],
        operandReady = true,
        replaceEntry = true,
        resultShown = false,
        error = "",
        memory = 0,
        repeat = null,
        history = [];
      const expressionLabel = el("div", {
        class: "calc-expression",
        "aria-live": "polite",
      });
      const display = el("input", {
        class: "calc-display sunken",
        readonly: true,
        value: "0",
        "aria-label": "Calculator display",
      });
      const memoryLabel = el("span", { class: "calc-memory-flag" });
      const controls = el("div", { class: "calc-controls" });
      const sciOptions = el("div", { class: "calc-sci-options" });
      const body = el("div", { class: "calc-body" });
      const status = el("div", { class: "calc-status" }, "");
      ctx.content.append(
        expressionLabel,
        el("div", { class: "calc-display-row" }, memoryLabel, display),
        sciOptions,
        controls,
        body,
        status,
      );
      const numericButtons = new Map();
      function current() {
        const value = Number(entry);
        if (!Number.isFinite(value)) throw new Error("Invalid number");
        return value;
      }
      function displayValue() {
        if (error) return error;
        if (base !== 10)
          return Math.trunc(current()).toString(base).toUpperCase();
        return entry;
      }
      function refresh() {
        display.value = displayValue();
        memoryLabel.textContent = memory ? "M" : "";
        expressionLabel.textContent = tokens
          .map((value) => ({ "*": "×", "/": "÷", "-": "−" })[value] || value)
          .join(" ");
        ctx.content.classList.toggle("calc-scientific", scientific);
        sciOptions.hidden = !scientific;
        numericButtons.forEach((control, digit) => {
          control.disabled = parseInt(digit, 16) >= base;
        });
        status.textContent =
          error ||
          (scientific
            ? `${angle === "deg" ? "Degrees" : angle === "rad" ? "Radians" : "Grads"}   ${base === 10 ? "Decimal" : base === 16 ? "Hexadecimal" : base === 8 ? "Octal" : "Binary"}`
            : "");
      }
      function attempt(action) {
        try {
          if (error) clearAll();
          action();
          error = "";
          refresh();
        } catch (failure) {
          error = failure.message;
          replaceEntry = true;
          refresh();
        }
      }
      function clearAll() {
        entry = "0";
        tokens = [];
        operandReady = true;
        replaceEntry = true;
        resultShown = false;
        repeat = null;
        error = "";
        refresh();
      }
      function digit(value) {
        attempt(() => {
          if (parseInt(value, 16) >= base) return;
          if (resultShown) {
            tokens = [];
            resultShown = false;
          }
          if (!operandReady && tokens.at(-1) === ")") tokens.push("*");
          if (base !== 10) {
            const old = replaceEntry
              ? ""
              : Math.abs(Math.trunc(current())).toString(base).toUpperCase();
            const text = (old === "0" ? "" : old) + value;
            if (text.length > 32) return;
            entry = String(parseInt(text, base));
          } else {
            if (replaceEntry || entry === "0") entry = value;
            else if (entry.length < 22) entry += value;
          }
          replaceEntry = false;
          operandReady = true;
        });
      }
      function decimal() {
        if (base !== 10) return;
        attempt(() => {
          if (resultShown) {
            tokens = [];
            resultShown = false;
          }
          if (!operandReady && tokens.at(-1) === ")") tokens.push("*");
          if (replaceEntry) entry = "0";
          if (!entry.includes(".") && !entry.includes("e")) entry += ".";
          operandReady = true;
          replaceEntry = false;
        });
      }
      function setValue(value) {
        entry = formatNumber(value);
        operandReady = true;
        replaceEntry = true;
      }
      function operation(op) {
        attempt(() => {
          if (operandReady) tokens.push(formatNumber(current()));
          if (!tokens.length) tokens.push("0");
          if (
            [
              "+",
              "-",
              "*",
              "/",
              "^",
              "mod",
              "and",
              "or",
              "xor",
              "lsh",
              "rsh",
            ].includes(tokens.at(-1))
          )
            tokens.pop();
          if (!scientific && tokens.length > 1) {
            setValue(evaluate(tokens));
            tokens = [entry];
          }
          tokens.push(op);
          operandReady = false;
          replaceEntry = true;
          resultShown = false;
        });
      }
      function equals() {
        attempt(() => {
          if (!tokens.length && resultShown && repeat)
            tokens = [entry, repeat.op, repeat.value];
          else if (operandReady) tokens.push(formatNumber(current()));
          else if (tokens.length && tokens.at(-1) !== ")")
            tokens.push(formatNumber(current()));
          if (!tokens.length) return;
          const open =
            tokens.filter((t) => t === "(").length -
            tokens.filter((t) => t === ")").length;
          for (let i = 0; i < open; i++) tokens.push(")");
          const expression = tokens.join(" "),
            result = evaluate(tokens);
          if (
            tokens.length >= 3 &&
            !["(", ")"].includes(tokens.at(-1)) &&
            ["+", "-", "*", "/", "^", "mod"].includes(tokens.at(-2))
          )
            repeat = { op: tokens.at(-2), value: tokens.at(-1) };
          else if (!resultShown) repeat = null;
          setValue(result);
          history.unshift({ expression, result: entry });
          history = history.slice(0, 50);
          tokens = [];
          resultShown = true;
        });
      }
      function unary(action) {
        attempt(() => {
          setValue(action(current()));
          resultShown = tokens.length === 0;
        });
      }
      function sign() {
        attempt(() => {
          if (/e[+-]?\d*$/i.test(entry) && !replaceEntry) {
            entry = entry.replace(
              /e([+-]?)/i,
              (_, sign) => `e${sign === "-" ? "+" : "-"}`,
            );
          } else
            entry = entry.startsWith("-")
              ? entry.slice(1)
              : entry !== "0"
                ? `-${entry}`
                : "0";
        });
      }
      function percent() {
        unary((value) => {
          const index = tokens.findLastIndex(
            (token) => token === "+" || token === "-",
          );
          if (index > 0)
            return (evaluate(tokens.slice(0, index)) * value) / 100;
          return value / 100;
        });
      }
      function backspace() {
        attempt(() => {
          if (replaceEntry) return;
          if (base !== 10) {
            const text = Math.abs(Math.trunc(current()))
              .toString(base)
              .slice(0, -1);
            entry = String(text ? parseInt(text, base) : 0);
          } else {
            entry = entry.slice(0, -1);
            if (!entry || entry === "-") entry = "0";
          }
        });
      }
      function parentheses(close) {
        attempt(() => {
          if (!close) {
            if (resultShown) {
              tokens = [];
              resultShown = false;
            }
            if (operandReady && !replaceEntry) {
              tokens.push(entry, "*");
            } else if (tokens.at(-1) === ")") tokens.push("*");
            tokens.push("(");
            operandReady = false;
            replaceEntry = true;
          } else {
            const depth =
              tokens.filter((t) => t === "(").length -
              tokens.filter((t) => t === ")").length;
            if (!depth) return;
            if (operandReady) tokens.push(entry);
            if (tokens.at(-1) === "(") tokens.push("0");
            let nested = 0,
              start = -1;
            for (let index = tokens.length - 1; index >= 0; index--) {
              if (tokens[index] === ")") nested++;
              if (tokens[index] === "(") {
                if (!nested) {
                  start = index;
                  break;
                }
                nested--;
              }
            }
            tokens.push(")");
            if (start >= 0) entry = formatNumber(evaluate(tokens.slice(start)));
            operandReady = false;
            replaceEntry = true;
          }
        });
      }
      function trig(kind) {
        unary((value) => {
          const toRad =
            angle === "deg"
              ? Math.PI / 180
              : angle === "grad"
                ? Math.PI / 200
                : 1;
          const name = `${inverse ? "a" : ""}${kind}${hyperbolic ? "h" : ""}`;
          const result = Math[name](
            inverse || hyperbolic ? value : value * toRad,
          );
          return inverse && !hyperbolic ? result / toRad : result;
        });
      }
      function memoryAction(kind) {
        attempt(() => {
          if (kind === "MC") memory = 0;
          if (kind === "MR") {
            setValue(memory);
            resultShown = !tokens.length;
          }
          if (kind === "MS") memory = current();
          if (kind === "M+") memory += current();
          if (kind === "M-") memory -= current();
        });
      }
      function calcButton(label, action, kind = "") {
        return button(
          label,
          () => {
            action();
            ctx.win.focus();
          },
          {
            class: `win-button calc-key ${kind}`,
            "aria-label":
              {
                "←": "Backspace",
                "√": "Square root",
                "±": "Change sign",
                "÷": "Divide",
                "×": "Multiply",
                "−": "Subtract",
              }[label] || label,
          },
        );
      }
      const memrow = el(
        "div",
        { class: "calc-memory-row" },
        ["MC", "MR", "MS", "M+", "M-"].map((label) =>
          calcButton(label, () => memoryAction(label), "calc-memory-key"),
        ),
      );
      controls.append(
        memrow,
        el(
          "div",
          { class: "calc-clear-row" },
          calcButton("Backspace", backspace, "calc-control-key"),
          calcButton(
            "CE",
            () => {
              entry = "0";
              operandReady = true;
              replaceEntry = true;
              error = "";
              refresh();
            },
            "calc-control-key",
          ),
          calcButton("C", clearAll, "calc-control-key"),
        ),
      );
      const degree = el("div", { class: "calc-angle-options" });
      ["deg", "rad", "grad"].forEach((value) =>
        degree.append(
          el(
            "label",
            {},
            el("input", {
              type: "radio",
              name: `calc-angle-${ctx.win.id}`,
              checked: value === angle,
              onChange: () => {
                angle = value;
                refresh();
              },
            }),
            { deg: "Deg", rad: "Rad", grad: "Grad" }[value],
          ),
        ),
      );
      const bases = el("div", { class: "calc-base-options" });
      [
        [16, "Hex"],
        [10, "Dec"],
        [8, "Oct"],
        [2, "Bin"],
      ].forEach(([value, label]) =>
        bases.append(
          el(
            "label",
            {},
            el("input", {
              type: "radio",
              name: `calc-base-${ctx.win.id}`,
              checked: value === base,
              onChange: () =>
                attempt(() => {
                  if (value !== 10) entry = formatNumber(Math.trunc(current()));
                  base = value;
                  replaceEntry = true;
                }),
            }),
            label,
          ),
        ),
      );
      sciOptions.append(
        degree,
        bases,
        el(
          "label",
          {},
          el("input", {
            type: "checkbox",
            onChange: (event) => {
              inverse = event.target.checked;
            },
          }),
          "Inv",
        ),
        el(
          "label",
          {},
          el("input", {
            type: "checkbox",
            onChange: (event) => {
              hyperbolic = event.target.checked;
            },
          }),
          "Hyp",
        ),
      );
      const sciGrid = el("div", { class: "calc-scientific-grid" });
      const sci = [
        ["sin", () => trig("sin")],
        ["cos", () => trig("cos")],
        ["tan", () => trig("tan")],
        ["π", () => unary(() => Math.PI)],
        ["x²", () => unary((x) => x * x)],
        ["x³", () => unary((x) => x * x * x)],
        ["xʸ", () => operation("^")],
        ["n!", () => unary(factorial)],
        ["log", () => unary((x) => (inverse ? 10 ** x : Math.log10(x)))],
        ["ln", () => unary((x) => (inverse ? Math.exp(x) : Math.log(x)))],
        [
          "Exp",
          () => {
            if (base === 10)
              attempt(() => {
                if (!entry.includes("e")) entry += "e+";
                replaceEntry = false;
                operandReady = true;
              });
          },
        ],
        ["Int", () => unary(Math.trunc)],
        ["Mod", () => operation("mod")],
        ["And", () => operation("and")],
        ["Or", () => operation("or")],
        ["Xor", () => operation("xor")],
        ["(", () => parentheses(false)],
        [")", () => parentheses(true)],
        ["Not", () => unary((x) => ~x)],
        ["Lsh", () => operation("lsh")],
        ["A", () => digit("A")],
        ["B", () => digit("B")],
        ["C", () => digit("C")],
        ["D", () => digit("D")],
        ["E", () => digit("E")],
        ["F", () => digit("F")],
        ["Rsh", () => operation("rsh")],
        ["Rand", () => unary(Math.random)],
      ];
      sci.forEach(([label, action]) => {
        const control = calcButton(label, action, "calc-science-key");
        if (/^[A-F]$/.test(label)) numericButtons.set(label, control);
        sciGrid.append(control);
      });
      const main = el("div", { class: "calc-main-grid" });
      const keys = [
        ["7", () => digit("7")],
        ["8", () => digit("8")],
        ["9", () => digit("9")],
        ["÷", () => operation("/")],
        ["√", () => unary(Math.sqrt)],
        ["4", () => digit("4")],
        ["5", () => digit("5")],
        ["6", () => digit("6")],
        ["×", () => operation("*")],
        ["%", percent],
        ["1", () => digit("1")],
        ["2", () => digit("2")],
        ["3", () => digit("3")],
        ["−", () => operation("-")],
        [
          "1/x",
          () =>
            unary((x) => {
              if (!x) throw new Error("Cannot divide by zero");
              return 1 / x;
            }),
        ],
        ["0", () => digit("0")],
        ["±", sign],
        [".", decimal],
        ["+", () => operation("+")],
        ["=", equals],
      ];
      keys.forEach(([label, action]) => {
        const control = calcButton(
          label,
          action,
          /^\d$/.test(label) || label === "." ? "calc-digit" : "calc-operator",
        );
        if (/^\d$/.test(label)) numericButtons.set(label, control);
        main.append(control);
      });
      body.append(sciGrid, main);
      async function paste() {
        const text = await os.pasteText();
        if (text == null) return;
        attempt(() => {
          const value =
            base === 10
              ? Number(text.trim().replaceAll(",", ""))
              : parseInt(text.trim(), base);
          if (!Number.isFinite(value))
            throw new Error("Clipboard does not contain a number");
          setValue(value);
          resultShown = !tokens.length;
        });
      }
      async function showHistory() {
        const list = el("div", { class: "calc-history listbox" });
        history.forEach((item) =>
          list.append(
            button(
              `${item.expression} = ${item.result}`,
              () => {
                setValue(Number(item.result));
                tokens = [];
                resultShown = true;
                refresh();
              },
              { class: "calc-history-item" },
            ),
          ),
        );
        if (!history.length) list.append(el("p", {}, "No calculations yet."));
        await os.dialog({
          title: "Calculation History",
          body: list,
          width: 410,
          buttons: [{ label: "Close", value: "close" }],
        });
      }
      function menu() {
        ctx.setMenu([
          {
            label: "&Edit",
            items: [
              {
                label: "&Copy",
                shortcut: "Ctrl+C",
                action: () => os.copyText(display.value),
              },
              { label: "&Paste", shortcut: "Ctrl+V", action: paste },
              { separator: true },
              { label: "Calculation &History...", action: showHistory },
              {
                label: "Clear &History",
                action: () => {
                  history = [];
                },
              },
            ],
          },
          {
            label: "&View",
            items: [
              {
                label: "&Standard",
                checked: !scientific,
                action: () => {
                  scientific = false;
                  base = 10;
                  tokens = [];
                  os.storage.set("calculator-scientific", false);
                  refresh();
                  menu();
                },
              },
              {
                label: "&Scientific",
                checked: scientific,
                action: () => {
                  scientific = true;
                  os.storage.set("calculator-scientific", true);
                  refresh();
                  menu();
                },
              },
            ],
          },
          helpMenu(
            ctx,
            "Calculator",
            "Standard arithmetic uses immediate execution. Scientific mode supports precedence, parentheses, powers, logarithms, factorials, trigonometry, degree/radian/grad modes, bases and 32-bit integer logic. Use the keyboard or keypad. Calculations use browser double precision.",
          ),
        ]);
      }
      listen(ctx, ctx.win.element, "keydown", (event) => {
        if (
          event.altKey ||
          event.defaultPrevented ||
          event.target.matches("select")
        )
          return;
        const key = event.key;
        let action;
        if (event.ctrlKey || event.metaKey) {
          if (key.toLowerCase() === "c")
            action = () => os.copyText(display.value);
          if (key.toLowerCase() === "v") action = paste;
        } else if (/^[0-9]$/.test(key) || (base === 16 && /^[a-f]$/i.test(key)))
          action = () => digit(key.toUpperCase());
        else
          action = {
            "+": () => operation("+"),
            "-": () => operation("-"),
            "*": () => operation("*"),
            "/": () => operation("/"),
            "^": () => operation("^"),
            ".": decimal,
            ",": decimal,
            "=": equals,
            Enter: equals,
            Escape: clearAll,
            Delete: clearAll,
            Backspace: backspace,
            "%": percent,
            "(": () => parentheses(false),
            ")": () => parentheses(true),
            "!": () => unary(factorial),
            F9: sign,
          }[key];
        if (action) {
          event.preventDefault();
          event.stopPropagation();
          action();
        }
      });
      refresh();
      menu();
    },
  });
}
