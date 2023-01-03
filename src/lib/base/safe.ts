// import { pr } from "../util/debug.js";
import { assertNonNull, mapAE } from "../../util/error.js";

import {
  aConst,
  aContextualKeyword,
  aVar,
  Block,
  CuSymbol,
  Scope,
  Env,
  Form,
  Id,
  isConst,
  isCuSymbol,
  JsSrc,
  TranspileError,
} from "../../types.js";
import * as EnvF from "../../env.js";
import {
  transpileExpression,
  transpileStatement,
  transpileBlock,
  transpiling1,
  transpiling2,
  transpilingForAssignment,
  transpilingForVariableMutation,
} from "../../transpile.js";
import { isNonExpressionCall } from "./common.js";

export namespace Safe {
  export const __const = transpilingForAssignment(
    "const",
    (env: Env, id: CuSymbol, exp: JsSrc) => {
      if (EnvF.isDefinedInThisScope(env, id.v)) {
        return new TranspileError(
          `Variable ${JSON.stringify(id.v)} is already defined!`,
        );
      }
      const r = EnvF.set(env, id.v, aConst());
      if (r instanceof TranspileError) {
        return r;
      }
      return `const ${id.v} = ${exp}`;
    },
  );

  export const __let = transpilingForAssignment(
    "let",
    (env: Env, id: CuSymbol, exp: JsSrc) => {
      if (EnvF.isDefinedInThisScope(env, id.v)) {
        return new TranspileError(
          `Variable ${JSON.stringify(id.v)} is already defined!`,
        );
      }
      const r = EnvF.set(env, id.v, aVar());
      if (r instanceof TranspileError) {
        return r;
      }
      return `let ${id.v} = ${exp}`;
    },
  );

  export const __else = aContextualKeyword("if");

  export async function __return(env: Env, ...args: Form[]): Promise<JsSrc | TranspileError> {
    switch (args.length) {
      case 0:
        return "return";
      case 1:
        const argSrc = await transpileExpression(args[0], env);
        if (argSrc instanceof TranspileError) {
          return argSrc;
        }
        return `return ${argSrc}`;
      default:
        return new TranspileError(
          "`return` must receive at most one expression!",
        );
    }
  }

  export async function when(
    env: Env,
    bool: Form,
    ...rest: Block
  ): Promise<JsSrc | TranspileError> {
    if (bool === undefined) {
      return new TranspileError("No expressions given to a `when` statement!");
    }
    if (rest.length < 1) {
      return new TranspileError("No statements given to a `when` statement!");
    }
    const boolSrc = await transpileExpression(bool, env);
    if (boolSrc instanceof TranspileError) {
      return boolSrc;
    }
    const statementsSrc = await transpileBlock(rest, env);
    if (statementsSrc instanceof TranspileError) {
      return statementsSrc;
    }
    return `if(${boolSrc}){\n${statementsSrc}\n}`;
  }

  export const incrementF = transpilingForVariableMutation("incrementF", "++");
  export const decrementF = transpilingForVariableMutation("decrementF", "--");
}

export function safe(): Scope {
  const b: Scope = new Map();

  b.set(
    "plusF",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} + ${b})`),
  );
  b.set(
    "minusF",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} - ${b})`),
  );
  b.set(
    "timesF",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} * ${b})`),
  );
  b.set(
    "dividedByF",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} / ${b})`),
  );

  b.set(
    "equals",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} === ${b})`),
  );
  b.set(
    "notEquals",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} !== ${b})`),
  );

  b.set(
    "isLessThan",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} < ${b})`),
  );
  b.set(
    "isLessThanOrEquals",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} <= ${b})`),
  );
  b.set(
    "isGreaterThan",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} > ${b})`),
  );
  b.set(
    "isGreaterThanOrEquals",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} >= ${b})`),
  );

  b.set(
    "and",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} && ${b})`),
  );
  b.set(
    "or",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} || ${b})`),
  );
  b.set(
    "not",
    transpiling1("not", (a: JsSrc) => `!(${a})`),
  );

  b.set("const", Safe.__const);
  b.set("let", Safe.__let);

  b.set(
    "assign",
    transpilingForAssignment("assign", (env: Env, id: CuSymbol, exp: JsSrc) => {
      const w = EnvF.find(env, id.v);
      if (w !== undefined && isConst(w)) {
        return new TranspileError(
          `Variable "${id.v}" is NOT declared by \`let\`!`,
        );
      }
      return `${id.v} = ${exp}`;
    }),
  );

  b.set("scope", async (env: Env, ...block: Block): Promise<JsSrc | TranspileError> => {
    EnvF.push(env);
    let result = "(\n";

    const funcSrc = await buildFn(env, "scope", [], block);
    if (funcSrc instanceof TranspileError) {
      return funcSrc;
    }
    result = `${result}${funcSrc}`;
    result = `${result})()`;

    EnvF.pop(env);
    return result;
  });

  b.set(
    "if",
    async (env: Env, bool: Form, ...rest: Form[]): Promise<JsSrc | TranspileError> => {
      const boolSrc = await transpileExpression(bool, env);
      if (boolSrc instanceof TranspileError) {
        return boolSrc;
      }

      const trueForms: Form[] = [];
      const falseForms: Form[] = [];
      let elseIsFound = false;
      for (const form of rest) {
        if (isCuSymbol(form) && EnvF.find(env, form.v) === Safe.__else) {
          if (elseIsFound) {
            return new TranspileError(
              "`else` is specified more than once in an `if` expression!",
            );
          }
          elseIsFound = true;
          continue;
        }
        if (elseIsFound) {
          falseForms.push(form);
        } else {
          trueForms.push(form);
        }
      }
      if (trueForms.length < 1) {
        if (elseIsFound) {
          return new TranspileError("No expressions specified before `else`!");
        }
        return new TranspileError(
          "No expressions given to an `if` expression!",
        );
      }
      if (falseForms.length < 1) {
        if (elseIsFound) {
          return new TranspileError("No expressions specified after `else`!");
        }
        return new TranspileError(
          "`else` not specified for an `if` expression!",
        );
      }

      const ifTrueSrcs = await mapAE(trueForms, TranspileError, async (ifTrue) =>
        await transpileExpression(ifTrue, env),
      );
      if (ifTrueSrcs instanceof TranspileError) {
        return ifTrueSrcs;
      }
      const ifTrueSrc =
        ifTrueSrcs.length > 1
          ? `(${ifTrueSrcs.join(", ")})`
          : assertNonNull(ifTrueSrcs[0], "Impossilbe");
      if (ifTrueSrc instanceof TranspileError) {
        return ifTrueSrc;
      }

      const ifFalseSrcs = await mapAE(falseForms, TranspileError, async (ifFalse) =>
        await transpileExpression(ifFalse, env),
      );
      if (ifFalseSrcs instanceof TranspileError) {
        return ifFalseSrcs;
      }
      const ifFalseSrc = ifFalseSrcs.join(", ");

      return `(${boolSrc} ? ${ifTrueSrc} : ${ifFalseSrc})`;
    },
  );

  b.set("else", Safe.__else);

  b.set(
    "fn",
    async (env: Env, args: Form, ...block: Form[]): Promise<JsSrc | TranspileError> => {
      return await buildFn(env, "fn", args, block);
    },
  );

  b.set(
    "procedure",
    async (env: Env, args: Form, ...block: Form[]): Promise<JsSrc | TranspileError> => {
      return await buildProcedure(env, "procedure", args, block);
    },
  );

  b.set("return", Safe.__return);

  b.set("when", Safe.when);

  b.set("incrementF", Safe.incrementF);
  b.set("decrementF", Safe.decrementF);

  b.set("array", async (env: Env, ...args: Form[]): Promise<JsSrc | TranspileError> => {
    const argsSrcs = await mapAE(args, TranspileError, async (arg) => await transpileExpression(arg, env));
    if (argsSrcs instanceof TranspileError) {
      return argsSrcs;
    }
    return `[${argsSrcs.join(",")}]`;
  });

  return b;
}

function functionPrelude(
  env: Env,
  formId: Id,
  args: Form,
  block: Block,
): JsSrc | TranspileError {
  if (!(args instanceof Array)) {
    return new TranspileError(
      `Arguments for a function must be an array of symbols! But actually ${JSON.stringify(
        args,
      )}`,
    );
  }
  if (block.length < 1) {
    return new TranspileError(
      `\`${formId}\` must receive at least one expression!`,
    );
  }

  EnvF.push(env);

  const argNames = [];
  for (const arg of args) {
    if (!isCuSymbol(arg)) {
      return new TranspileError(
        `Arguments for a function must be an array of symbols! But actually ${JSON.stringify(
          args,
        )}`,
      );
    }
    const r = EnvF.set(env, arg.v, aVar());
    if (r instanceof TranspileError) {
      return r;
    }
    argNames.push(arg.v);
  }

  return `(${argNames.join(", ")}) => {\n`;
}

function functionPostlude(env: Env, src: JsSrc): JsSrc {
  EnvF.pop(env);
  return `${src}}`;
}

async function buildFn(
  env: Env,
  formId: Id,
  args: Form,
  block: Block,
): Promise<JsSrc | TranspileError> {
  let result = functionPrelude(env, formId, args, block);
  if (result instanceof TranspileError) {
    return result;
  }

  const lastI = block.length - 1;
  for (let i = 0; i < lastI; ++i) {
    const src = await transpileStatement(block[i], env);
    if (src instanceof TranspileError) {
      return src;
    }
    result = `${result}  ${src};\n`;
  }

  const lastStatement = block[lastI];
  if (isNonExpressionCall(env, lastStatement)) {
    return new TranspileError(
      `The last statement in a \`${formId}\` must be an expression! But \`${lastStatement[0].v}\` is a statement!`,
    );
  }
  const lastSrc = await transpileStatement(lastStatement, env);
  if (lastSrc instanceof TranspileError) {
    return lastSrc;
  }
  result = `${result}  return ${lastSrc};\n`;

  return functionPostlude(env, result);
}

async function buildProcedure(
  env: Env,
  formId: Id,
  args: Form,
  block: Block,
): Promise<JsSrc | TranspileError> {
  let result = functionPrelude(env, formId, args, block);
  if (result instanceof TranspileError) {
    return result;
  }

  for (let i = 0; i < block.length; ++i) {
    const src = await transpileStatement(block[i], env);
    if (src instanceof TranspileError) {
      return src;
    }
    result = `${result}  ${src};\n`;
  }

  return functionPostlude(env, result);
}
