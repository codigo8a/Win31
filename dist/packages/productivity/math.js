const PRECEDENCE = {
  or: 1,
  xor: 2,
  and: 3,
  lsh: 4,
  rsh: 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
  mod: 6,
  "^": 7,
};
function operate(op, a, b) {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      if (!b) throw new Error("Cannot divide by zero");
      return a / b;
    case "mod":
      if (!b) throw new Error("Cannot divide by zero");
      return a % b;
    case "^":
      return Math.pow(a, b);
    case "and":
      return a & b;
    case "or":
      return a | b;
    case "xor":
      return a ^ b;
    case "lsh":
      return a << b;
    case "rsh":
      return a >> b;
    default:
      throw new Error("Invalid operation");
  }
}
export function evaluate(tokens) {
  let position = 0;
  function primary() {
    const token = tokens[position++];
    if (token === "(") {
      const value = expression(0);
      if (tokens[position++] !== ")")
        throw new Error("Missing closing parenthesis");
      return value;
    }
    if (token === "+") return primary();
    if (token === "-") return -primary();
    if (token === undefined || token === ")" || token === "")
      throw new Error("Incomplete expression");
    const value = Number(token);
    if (!Number.isFinite(value)) throw new Error("Invalid number");
    return value;
  }
  function expression(min) {
    let left = primary();
    while (position < tokens.length) {
      const op = tokens[position],
        precedence = PRECEDENCE[op];
      if (precedence === undefined || precedence < min) break;
      position++;
      const right = expression(precedence + (op === "^" ? 0 : 1));
      left = operate(op, left, right);
      if (!Number.isFinite(left))
        throw new Error("Result is not a real finite number");
    }
    return left;
  }
  if (!tokens.length) return 0;
  const result = expression(0);
  if (position !== tokens.length) throw new Error("Invalid expression");
  return result;
}
export function formatNumber(value) {
  if (!Number.isFinite(value))
    throw new Error("Result is not a real finite number");
  if (Object.is(value, -0) || value === 0) return "0";
  return Number(value.toPrecision(13)).toString();
}
export function factorial(value) {
  if (value < 0 || !Number.isInteger(value))
    throw new Error("Factorial requires a nonnegative integer");
  if (value > 170) throw new Error("Overflow");
  let result = 1;
  for (let i = 2; i <= value; i++) result *= i;
  return result;
}
