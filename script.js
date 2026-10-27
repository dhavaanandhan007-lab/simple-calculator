/**
 * Modern Dark Blue Calculator
 * 
 * Features:
 * - Standalone, zero-dependency Safe Arithmetic Parser (Lexer + Shunting-Yard + RPN Evaluator)
 * - Strict prevention of unsafe code evaluation (no eval, no Function constructor)
 * - Complete button interactivity (Numbers 0-9, Operators +, -, ×, ÷, %, ., AC, DEL, =)
 * - Error handling for division by zero, invalid formats, and numeric overflow
 * - Keyboard shortcuts with tactile active animation
 * - Dynamic display font resizing to prevent overflow
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // 1. Safe Arithmetic Parser
  // =========================================================================

  /**
   * Safe Arithmetic Parser
   * Evaluates mathematical expressions using Dijkstra's Shunting-Yard algorithm
   * and a Reverse Polish Notation (RPN) evaluator.
   */
  const SafeParser = {
    /**
     * Tokenizes a raw mathematical string.
     * @param {string} expr - Expression string
     * @returns {Array<{type: string, value: any}>} Array of tokens
     */
    tokenize(expr) {
      // Normalize visual operators and remove extra spaces
      const clean = expr
        .replace(/[\u00D7\u2715\u2A2F×*]/g, '*')
        .replace(/[\u00F7÷/]/g, '/')
        .replace(/\s+/g, '');

      const tokens = [];
      let i = 0;

      while (i < clean.length) {
        const char = clean[i];

        // Numbers & Decimals
        if (/[0-9.]/.test(char)) {
          let numStr = '';
          let dotCount = 0;

          while (i < clean.length && /[0-9.]/.test(clean[i])) {
            if (clean[i] === '.') {
              dotCount++;
              if (dotCount > 1) {
                throw new Error('Invalid decimal format');
              }
            }
            numStr += clean[i];
            i++;
          }

          tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
          continue;
        }

        // Operators (+, -, *, /, %)
        if ('+-*/%'.includes(char)) {
          // Detect unary operators (+ or - at start or after an operator)
          const prevToken = tokens[tokens.length - 1];
          const isUnary = (char === '-' || char === '+') && (
            tokens.length === 0 ||
            (prevToken.type === 'OPERATOR' && prevToken.value !== '%') ||
            (prevToken.type === 'PAREN' && prevToken.value === '(')
          );

          if (isUnary) {
            i++; // Move past sign
            // Unary + can simply be ignored if preceding a number
            let numStr = char === '-' ? '-' : '';
            let dotCount = 0;

            if (i >= clean.length || !/[0-9.]/.test(clean[i])) {
              throw new Error('Invalid syntax');
            }

            while (i < clean.length && /[0-9.]/.test(clean[i])) {
              if (clean[i] === '.') {
                dotCount++;
                if (dotCount > 1) throw new Error('Invalid decimal format');
              }
              numStr += clean[i];
              i++;
            }

            tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
            continue;
          }

          tokens.push({ type: 'OPERATOR', value: char });
          i++;
          continue;
        }

        // Parentheses support
        if (char === '(' || char === ')') {
          tokens.push({ type: 'PAREN', value: char });
          i++;
          continue;
        }

        throw new Error(`Unexpected character: '${char}'`);
      }

      return tokens;
    },

    /**
     * Converts infix tokens to postfix (RPN) using Dijkstra's Shunting-Yard.
     * @param {Array} tokens - Infix token array
     * @returns {Array} Postfix token array
     */
    toRPN(tokens) {
      const outputQueue = [];
      const operatorStack = [];
      const precedence = {
        '+': 1,
        '-': 1,
        '*': 2,
        '/': 2,
        '%': 3 // Postfix percentage has highest precedence
      };

      for (const token of tokens) {
        if (token.type === 'NUMBER') {
          outputQueue.push(token);
        } else if (token.type === 'OPERATOR') {
          // Postfix % converts preceding operand to value / 100
          if (token.value === '%') {
            if (outputQueue.length === 0) throw new Error('Invalid percentage format');
            const top = outputQueue.pop();
            outputQueue.push({ type: 'NUMBER', value: top.value / 100 });
            continue;
          }

          while (
            operatorStack.length > 0 &&
            operatorStack[operatorStack.length - 1].type === 'OPERATOR' &&
            precedence[operatorStack[operatorStack.length - 1].value] >= precedence[token.value]
          ) {
            outputQueue.push(operatorStack.pop());
          }
          operatorStack.push(token);
        } else if (token.type === 'PAREN') {
          if (token.value === '(') {
            operatorStack.push(token);
          } else if (token.value === ')') {
            while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1].value !== '(') {
              outputQueue.push(operatorStack.pop());
            }
            if (operatorStack.length === 0) throw new Error('Mismatched parentheses');
            operatorStack.pop(); // Discard '('
          }
        }
      }

      while (operatorStack.length > 0) {
        const op = operatorStack.pop();
        if (op.type === 'PAREN') throw new Error('Mismatched parentheses');
        outputQueue.push(op);
      }

      return outputQueue;
    },

    /**
     * Evaluates Reverse Polish Notation (RPN) queue.
     * @param {Array} rpnQueue - Postfix token array
     * @returns {number} Evaluated result
     */
    evaluateRPN(rpnQueue) {
      const stack = [];

      for (const token of rpnQueue) {
        if (token.type === 'NUMBER') {
          stack.push(token.value);
        } else if (token.type === 'OPERATOR') {
          if (stack.length < 2) {
            throw new Error('Invalid expression format');
          }
          const b = stack.pop();
          const a = stack.pop();
          let result;

          switch (token.value) {
            case '+':
              result = a + b;
              break;
            case '-':
              result = a - b;
              break;
            case '*':
              result = a * b;
              break;
            case '/':
              if (b === 0) {
                throw new Error('Cannot divide by zero');
              }
              result = a / b;
              break;
            default:
              throw new Error(`Unsupported operator: ${token.value}`);
          }

          stack.push(result);
        }
      }

      if (stack.length !== 1) {
        throw new Error('Invalid expression format');
      }

      const finalResult = stack[0];

      if (!Number.isFinite(finalResult)) {
        throw new Error('Number overflow');
      }

      // Mitigate IEEE 754 floating-point inaccuracies (e.g. 0.1 + 0.2 = 0.3)
      return Math.round((finalResult + Number.EPSILON) * 1e10) / 1e10;
    },

    /**
     * Public evaluate method.
     * @param {string} expression - Mathematical string
     * @returns {number} Result of computation
     */
    evaluate(expression) {
      if (!expression || !expression.trim()) {
        return 0;
      }
      const tokens = this.tokenize(expression);
      if (tokens.length === 0) return 0;
      const rpn = this.toRPN(tokens);
      return this.evaluateRPN(rpn);
    }
  };


  // =========================================================================
  // 2. Calculator UI & State Controller
  // =========================================================================

  class CalculatorController {
    constructor() {
      // DOM Elements
      this.previousOperandElement = document.getElementById('previous-operand');
      this.currentOperandElement = document.getElementById('current-operand');
      this.buttons = document.querySelectorAll('.btn');

      // State variables
      this.currentOperand = '0';
      this.previousOperand = '';
      this.operation = undefined;
      this.hasError = false;
      this.shouldResetScreen = false;

      this.initEventListeners();
      this.updateDisplay();
    }

    /**
     * Attach click and keyboard listeners
     */
    initEventListeners() {
      // Button Clicks
      this.buttons.forEach(button => {
        button.addEventListener('click', () => {
          this.handleButtonClick(button);
        });
      });

      // Keyboard Controls
      window.addEventListener('keydown', (e) => {
        this.handleKeyboardInput(e);
      });
    }

    /**
     * Routes button actions based on data attributes
     */
    handleButtonClick(button) {
      const number = button.getAttribute('data-number');
      const operator = button.getAttribute('data-operator');
      const action = button.getAttribute('data-action');

      if (number !== null) {
        this.appendNumber(number);
      } else if (operator !== null) {
        this.chooseOperation(operator);
      } else if (action !== null) {
        switch (action) {
          case 'clear':
            this.clear();
            break;
          case 'delete':
            this.delete();
            break;
          case 'decimal':
            this.appendDecimal();
            break;
          case 'percent':
            this.applyPercent();
            break;
          case 'calculate':
            this.compute();
            break;
        }
      }

      this.updateDisplay();
    }

    /**
     * Resets calculator to initial clean state
     */
    clear() {
      this.currentOperand = '0';
      this.previousOperand = '';
      this.operation = undefined;
      this.hasError = false;
      this.shouldResetScreen = false;
      this.clearActiveOperatorHighlight();
    }

    /**
     * Deletes the most recent character
     */
    delete() {
      if (this.hasError || this.shouldResetScreen) {
        this.clear();
        return;
      }

      if (this.currentOperand.length === 1 || this.currentOperand === '0') {
        this.currentOperand = '0';
      } else {
        this.currentOperand = this.currentOperand.slice(0, -1);
      }
    }

    /**
     * Appends a digit (0-9)
     */
    appendNumber(number) {
      if (this.hasError || this.shouldResetScreen) {
        this.currentOperand = '';
        this.previousOperand = '';
        this.hasError = false;
        this.shouldResetScreen = false;
      }

      // Prevent multiple leading zeros
      if (this.currentOperand === '0' && number === '0') return;
      if (this.currentOperand === '0' && number !== '0') {
        this.currentOperand = number;
        return;
      }

      // Max input length protection
      if (this.currentOperand.length >= 16) return;

      this.currentOperand += number;
    }

    /**
     * Appends decimal point (.) safely
     */
    appendDecimal() {
      if (this.hasError || this.shouldResetScreen) {
        this.currentOperand = '0';
        this.previousOperand = '';
        this.hasError = false;
        this.shouldResetScreen = false;
      }

      if (this.currentOperand.includes('.')) return;
      this.currentOperand += '.';
    }

    /**
     * Handles percentage action
     */
    applyPercent() {
      if (this.hasError) return;

      try {
        const val = parseFloat(this.currentOperand);
        if (isNaN(val)) return;

        const percentVal = SafeParser.evaluate(`${val} %`);
        this.currentOperand = percentVal.toString();
        this.shouldResetScreen = true;
      } catch (err) {
        this.showError(err.message);
      }
    }

    /**
     * Sets operator and chains calculations
     */
    chooseOperation(operator) {
      if (this.hasError) return;

      // If user starts fresh calculation with previous result
      if (this.shouldResetScreen) {
        this.previousOperand = '';
        this.shouldResetScreen = false;
      }

      // Handle unary negative start (e.g., clicking minus first)
      if (this.currentOperand === '0' && this.previousOperand === '' && operator === '-') {
        this.currentOperand = '-';
        return;
      }

      // If user clicks another operator right after one without entering numbers, change operator
      if (this.currentOperand === '' && this.previousOperand !== '') {
        this.operation = operator;
        this.previousOperand = this.previousOperand.replace(/[\+\-\×\÷\*\/]\s*$/, `${operator} `);
        this.highlightActiveOperator(operator);
        return;
      }

      // If an operation is already pending, evaluate intermediate expression first
      if (this.previousOperand !== '') {
        this.computeIntermediate();
      }

      this.operation = operator;
      this.previousOperand = `${this.currentOperand} ${operator} `;
      this.currentOperand = '';
      this.highlightActiveOperator(operator);
    }

    /**
     * Computes intermediate chained calculation (e.g. 10 + 5 + 2)
     */
    computeIntermediate() {
      if (!this.previousOperand || !this.currentOperand) return;

      const rawExpression = `${this.previousOperand}${this.currentOperand}`;
      try {
        const result = SafeParser.evaluate(rawExpression);
        this.currentOperand = result.toString();
        this.previousOperand = '';
      } catch (err) {
        this.showError(err.message);
      }
    }

    /**
     * Evaluates the full expression when Equals (=) is clicked
     */
    compute() {
      if (this.hasError || !this.previousOperand) return;

      // If currentOperand is empty, use the previous value
      const operandToUse = this.currentOperand === '' 
        ? this.previousOperand.trim().split(' ')[0] 
        : this.currentOperand;

      const fullExpression = `${this.previousOperand}${operandToUse}`;

      try {
        const result = SafeParser.evaluate(fullExpression);
        this.previousOperand = `${fullExpression} =`;
        this.currentOperand = result.toString();
        this.operation = undefined;
        this.shouldResetScreen = true;
        this.clearActiveOperatorHighlight();
      } catch (err) {
        this.showError(err.message);
      }
    }

    /**
     * Displays a clean user-friendly error message
     */
    showError(message) {
      this.hasError = true;
      this.currentOperand = message || 'Error';
      this.previousOperand = '';
      this.operation = undefined;
      this.clearActiveOperatorHighlight();
    }

    /**
     * Updates display elements and dynamically resizes font
     */
    updateDisplay() {
      this.previousOperandElement.textContent = this.previousOperand;
      this.currentOperandElement.textContent = this.currentOperand;

      if (this.hasError) {
        this.currentOperandElement.classList.add('error');
      } else {
        this.currentOperandElement.classList.remove('error');
      }

      // Responsive font-scaling for large numbers
      this.adjustDisplayFontSize();
    }

    /**
     * Dynamically adjusts font size based on input string length
     */
    adjustDisplayFontSize() {
      if (this.hasError) return;

      const len = this.currentOperand.length;
      if (len > 14) {
        this.currentOperandElement.style.fontSize = '1.4rem';
      } else if (len > 10) {
        this.currentOperandElement.style.fontSize = '1.8rem';
      } else if (len > 7) {
        this.currentOperandElement.style.fontSize = '2.1rem';
      } else {
        this.currentOperandElement.style.fontSize = '';
      }
    }

    /**
     * Visually highlights the pending operator button
     */
    highlightActiveOperator(operator) {
      this.clearActiveOperatorHighlight();
      const opBtn = Array.from(this.buttons).find(b => b.getAttribute('data-operator') === operator);
      if (opBtn) {
        opBtn.classList.add('active-operator');
      }
    }

    /**
     * Clears all operator button highlights
     */
    clearActiveOperatorHighlight() {
      this.buttons.forEach(btn => btn.classList.remove('active-operator'));
    }

    /**
     * Keyboard event handler
     */
    handleKeyboardInput(e) {
      const key = e.key;

      // Numbers 0–9
      if (key >= '0' && key <= '9') {
        this.triggerButtonAnimation(`[data-number="${key}"]`);
        this.appendNumber(key);
      } else if (key === '.') {
        this.triggerButtonAnimation('[data-action="decimal"]');
        this.appendDecimal();
      } else if (key === '+' || key === '-') {
        this.triggerButtonAnimation(`[data-operator="${key}"]`);
        this.chooseOperation(key);
      } else if (key === '*') {
        this.triggerButtonAnimation('[data-operator="×"]');
        this.chooseOperation('×');
      } else if (key === '/') {
        e.preventDefault(); // Prevent browser quick-find
        this.triggerButtonAnimation('[data-operator="÷"]');
        this.chooseOperation('÷');
      } else if (key === '%') {
        this.triggerButtonAnimation('[data-action="percent"]');
        this.applyPercent();
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        this.triggerButtonAnimation('[data-action="calculate"]');
        this.compute();
      } else if (key === 'Backspace') {
        this.triggerButtonAnimation('[data-action="delete"]');
        this.delete();
      } else if (key === 'Escape' || key.toLowerCase() === 'c') {
        this.triggerButtonAnimation('[data-action="clear"]');
        this.clear();
      }

      this.updateDisplay();
    }

    /**
     * Triggers active visual pulse when keyboard shortcuts are pressed
     */
    triggerButtonAnimation(selector) {
      const btn = document.querySelector(selector);
      if (btn) {
        btn.classList.add('keyboard-active');
        setTimeout(() => {
          btn.classList.remove('keyboard-active');
        }, 150);
      }
    }
  }

  // Initialize the calculator
  window.calculatorApp = new CalculatorController();
});
