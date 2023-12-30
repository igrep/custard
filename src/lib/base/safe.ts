import * as fs from "node:fs/promises";
import * as path from "node:path";

import * as EnvF from "../../internal/env.js";
import {
  transpileBlock,
  transpileExpression,
  transpileJoinWithComma,
} from "../../internal/transpile.js";
import { pseudoTopLevelAssignment } from "../../internal/cu-env.js";
import {
  defaultScopeOptions,
  isLiteralArray,
  isLiteralObject,
  isVar,
  ordinaryExpression,
  ordinaryStatement,
} from "../../internal/types.js";

import {
  aConst,
  aContextualKeyword,
  aVar,
  Block,
  CuSymbol,
  Env,
  Form,
  Id,
  isCuSymbol,
  JsSrc,
  markAsDirectWriter,
  markAsDynamicVar,
  TranspileError,
} from "../../types.js";
import {
  buildFn,
  buildProcedure,
  buildScope,
  constructorFor,
  transpiling1,
  transpiling1Unmarked,
  transpiling2,
  transpilingForAssignment,
  transpilingForVariableDeclaration,
  transpilingForVariableMutation,
} from "./common.js";

export { standardModuleRoot } from "../../definitions.js";

export const note = markAsDirectWriter(
  (_env: Env, ..._args: Form[]): Promise<JsSrc> => Promise.resolve("void 0"),
);

export const annotate = markAsDirectWriter(
  async (env: Env, ...args: Form[]): Promise<JsSrc | TranspileError> => {
    return await transpileExpression(args[args.length - 1], env);
  },
);

export const _cu$const = transpilingForVariableDeclaration(
  "const",
  (assignee: JsSrc, exp: JsSrc) => `const ${assignee}=${exp}`,
  aConst,
);

export const _cu$let = transpilingForVariableDeclaration(
  "let",
  (assignee: JsSrc, exp: JsSrc) => `let ${assignee}=${exp}`,
  aVar,
);

export const _cu$return = markAsDirectWriter(
  async (env: Env, ...args: Form[]): Promise<JsSrc | TranspileError> => {
    switch (args.length) {
      case 0:
        return "return";
      case 1:
        const argSrc = await transpileExpression(args[0], env);
        if (TranspileError.is(argSrc)) {
          return argSrc;
        }
        return `return ${argSrc}`;
      default:
        return new TranspileError(
          "`return` must receive at most one expression!",
        );
    }
  },
  ordinaryStatement,
);

export const when = markAsDirectWriter(
  async (
    env: Env,
    bool: Form,
    ...rest: Block
  ): Promise<JsSrc | TranspileError> => {
    if (bool === undefined) {
      return new TranspileError("No expressions given to a `when` statement!");
    }
    const boolSrc = await transpileExpression(bool, env);
    if (TranspileError.is(boolSrc)) {
      return boolSrc;
    }
    const statementsSrc = await transpileBlock(rest, env);
    if (TranspileError.is(statementsSrc)) {
      return statementsSrc;
    }
    return `if(${boolSrc}){\n${statementsSrc}\n}`;
  },
  ordinaryStatement,
);

export const incrementF = transpilingForVariableMutation(
  "incrementF",
  (jsSrc) => `${jsSrc}+1`,
  (jsSrc) => `${jsSrc}++`,
);

export const decrementF = transpilingForVariableMutation(
  "decrementF",
  (jsSrc) => `${jsSrc}-1`,
  (jsSrc) => `${jsSrc}--`,
);

export const plusF = transpiling2("plusF", (a: JsSrc, b: JsSrc) => `${a}+${b}`);
export const minusF = transpiling2(
  "minusF",
  (a: JsSrc, b: JsSrc) => `(${a}-${b})`,
);
export const timesF = transpiling2(
  "timesF",
  (a: JsSrc, b: JsSrc) => `${a}*${b}`,
);
export const dividedByF = transpiling2(
  "dividedByF",
  (a: JsSrc, b: JsSrc) => `${a}/${b}`,
);

// TODO: If one of the argument is null, use == or !=
export const equals = transpiling2(
  "equals",
  (a: JsSrc, b: JsSrc) => `${a}===${b}`,
);
export const notEquals = transpiling2(
  "notEquals",
  (a: JsSrc, b: JsSrc) => `${a}!==${b}`,
);

export const isLessThan = transpiling2(
  "isLessThan",
  (a: JsSrc, b: JsSrc) => `${a}<${b}`,
);
export const isLessThanOrEquals = transpiling2(
  "isLessThanOrEquals",
  (a: JsSrc, b: JsSrc) => `${a}<=${b}`,
);
export const isGreaterThan = transpiling2(
  "isGreaterThan",
  (a: JsSrc, b: JsSrc) => `${a}>${b}`,
);
export const isGreaterThanOrEquals = transpiling2(
  "isGreaterThanOrEquals",
  (a: JsSrc, b: JsSrc) => `${a}>=${b}`,
);

export const isNone = transpiling1("isNone", (a: JsSrc) => `${a}==null`);

export const and = transpiling2("and", (a: JsSrc, b: JsSrc) => `${a}&&${b}`);
export const or = transpiling2("or", (a: JsSrc, b: JsSrc) => `${a}||${b}`);
export const not = transpiling1("not", (a: JsSrc) => `!(${a})`);

export const assign = transpilingForAssignment(
  "assign",
  async (env: Env, id: Form, exp: JsSrc): Promise<JsSrc | TranspileError> => {
    function assignStatement(sym: CuSymbol, e: JsSrc): JsSrc | TranspileError {
      const r = EnvF.findWithIsAtTopLevel(env, sym);
      if (r === undefined || !isVar(r.writer)) {
        return new TranspileError(
          `\`${sym.v}\` is not a name of a variable declared by \`let\` or a mutable property!`,
        );
      }
      if (EnvF.writerIsAtReplTopLevel(env, r)) {
        return pseudoTopLevelAssignment(sym.v, e);
      }
      return `${sym.v}=${e}`;
    }

    if (isCuSymbol(id)) {
      return assignStatement(id, exp);
    }

    if (isLiteralObject(id)) {
      const { id: tmpVar, statement } = EnvF.tmpVarOf(env, exp);
      let src = statement;
      for (const kvOrSym of id.v) {
        if (isCuSymbol(kvOrSym)) {
          const assignment = assignStatement(kvOrSym, `${tmpVar}.${kvOrSym.v}`);
          if (TranspileError.is(assignment)) {
            return assignment;
          }
          src = `${src}${assignment}\n`;
          continue;
        }
        const [k, v] = kvOrSym;
        if (!isCuSymbol(v)) {
          return new TranspileError(
            `Assignee must be a symbol, but ${JSON.stringify(v)} is not!`,
          );
        }

        let assignment: JsSrc | TranspileError;
        if (isCuSymbol(k)) {
          assignment = assignStatement(v, `${tmpVar}.${k.v}`);
        } else {
          const kSrc = await transpileExpression(k, env);
          if (TranspileError.is(kSrc)) {
            return kSrc;
          }
          assignment = assignStatement(v, `${tmpVar}${kSrc}`);
        }
        if (TranspileError.is(assignment)) {
          return assignment;
        }
        src = `${src}${assignment}\n`;
      }
      return src;
    }

    if (isLiteralArray(id)) {
      const { id: tmpVar, statement } = EnvF.tmpVarOf(env, exp);
      let src = statement;
      for (const [k, v] of id.v.entries()) {
        if (isCuSymbol(v)) {
          const assignment = assignStatement(v, `${tmpVar}[${k}]`);
          if (TranspileError.is(assignment)) {
            return assignment;
          }
          src = `${src}${assignment}\n`;
          continue;
        }
        const vJson = JSON.stringify(v);
        return new TranspileError(
          `assign's assignee must be a symbol, but ${vJson} is not!`,
        );
      }
      return src;
    }
    const vJson = JSON.stringify(id);
    return new TranspileError(
      `assign's assignee must be a symbol, but ${vJson} is not!`,
    );
  },
  ordinaryExpression,
);

export const scope = buildScope("scope", "", defaultScopeOptions);

export const _cu$if = markAsDirectWriter(
  async (
    env: Env,
    bool: Form,
    ...rest: Form[]
  ): Promise<JsSrc | TranspileError> => {
    const boolSrc = await transpileExpression(bool, env);
    if (TranspileError.is(boolSrc)) {
      return boolSrc;
    }

    // TODO: forms must be non-statements
    const trueForms: Form[] = [];
    const falseForms: Form[] = [];
    let elseIsFound = false;
    for (const form of rest) {
      if (isCuSymbol(form) && EnvF.find(env, form) === _cu$else) {
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
      return new TranspileError("No expressions given to an `if` expression!");
    }
    if (falseForms.length < 1) {
      if (elseIsFound) {
        return new TranspileError("No expressions specified after `else`!");
      }
      return new TranspileError("`else` not specified for an `if` expression!");
    }

    const ifTrueSrc = await transpileJoinWithComma(trueForms, env);
    if (TranspileError.is(ifTrueSrc)) {
      return ifTrueSrc;
    }

    const ifFalseSrc = await transpileJoinWithComma(falseForms, env);
    if (TranspileError.is(ifFalseSrc)) {
      return ifFalseSrc;
    }

    return `(${boolSrc}?(${ifTrueSrc}):(${ifFalseSrc}))`;
  },
);

export const _cu$else = aContextualKeyword("if");

// TODO: refactor with a feature to define syntax
export const _cu$try = markAsDirectWriter(
  async (env: Env, ...statements: Form[]): Promise<JsSrc | TranspileError> => {
    let trys: JsSrc = "";
    let catchs: JsSrc = "";
    let finallys: JsSrc = "";

    const initial = 0;
    const catchFound = 1;
    const finallyFound = 2;
    type State = typeof initial | typeof catchFound | typeof finallyFound;
    let state: State = initial;
    let catchVarName: Id | undefined = undefined;

    EnvF.pushInherited(env);
    for (const form of statements) {
      let isCatch = false;
      let isFinally = false;
      let transpiled: JsSrc | TranspileError;
      if (isCuSymbol(form)) {
        isCatch = EnvF.find(env, form) === _cu$catch;
        isFinally = EnvF.find(env, form) === _cu$finally;
      }
      switch (state) {
        case initial:
          if (isCatch) {
            EnvF.pop(env);
            state = catchFound;
            continue;
          }
          if (isFinally) {
            EnvF.pop(env);
            state = finallyFound;
            continue;
          }
          transpiled = await transpileExpression(form, env);
          if (TranspileError.is(transpiled)) {
            return transpiled;
          }
          trys = `${trys};\n${transpiled}`;
          break;
        case catchFound:
          if (isCatch) {
            return new TranspileError(
              "`catch` clause specified more than once",
            );
          }

          if (catchVarName === undefined) {
            if (isFinally) {
              return new TranspileError(
                "No variable name of the caught exception given to a `catch` clause!",
              );
            }
            if (isCuSymbol(form)) {
              EnvF.pushInherited(env);
              const r = EnvF.set(env, form.v, aConst());
              if (TranspileError.is(r)) {
                return r;
              }
              catchVarName = form.v;
              continue;
            }
            return new TranspileError(
              "No variable name of the caught exception given to a `catch` clause!",
            );
          }

          if (isFinally) {
            EnvF.pop(env);
            state = finallyFound;
            continue;
          }

          transpiled = await transpileExpression(form, env);
          if (TranspileError.is(transpiled)) {
            return transpiled;
          }
          catchs = `${catchs};\n${transpiled}`;
          break;
        case finallyFound:
          if (isCatch) {
            return new TranspileError(
              "A `finally` clause must be followed by a `catch` clause!",
            );
          }
          if (isFinally) {
            return new TranspileError(
              "`finally` clause specified more than once",
            );
          }

          if (finallys === "") {
            EnvF.pushInherited(env);
          }

          transpiled = await transpileExpression(form, env);
          if (TranspileError.is(transpiled)) {
            return transpiled;
          }
          finallys = `${finallys};\n${transpiled}`;
          break;
      }
    }

    EnvF.pop(env);

    if (state === initial) {
      return new TranspileError(
        "Nither `catch` nor `finally` given to a `try` statement!",
      );
    }

    let result = `try {${trys}}`;
    if (catchVarName !== undefined) {
      result = `${result}catch(${catchVarName}){${catchs}}`;
    } else if (state === catchFound) {
      return new TranspileError(
        "No variable name of the caught exception given to a `catch` clause!",
      );
    }

    if (state === finallyFound) {
      result = `${result}finally{${finallys}}`;
    }
    return result;
  },
  ordinaryStatement,
);

export const _cu$catch = aContextualKeyword("try");

export const _cu$finally = aContextualKeyword("try");

export const _cu$throw = transpiling1(
  "throw",
  (a: JsSrc) => `throw ${a}`,
  ordinaryStatement,
);

export const fn = markAsDirectWriter(
  async (
    env: Env,
    args: Form,
    ...block: Form[]
  ): Promise<JsSrc | TranspileError> => {
    return await buildFn("fn", env, args, block, defaultScopeOptions, "", "=>");
  },
);

export const procedure = markAsDirectWriter(
  async (
    env: Env,
    args: Form,
    ...block: Form[]
  ): Promise<JsSrc | TranspileError> => {
    return await buildProcedure(
      "procedure",
      env,
      args,
      block,
      defaultScopeOptions,
      "",
      "=>",
    );
  },
);

export const generatorFn = markAsDirectWriter(
  async (
    env: Env,
    args: Form,
    ...block: Form[]
  ): Promise<JsSrc | TranspileError> => {
    return await buildFn(
      "generatorFn",
      env,
      args,
      block,
      { isAsync: false, isGenerator: true },
      "function*",
      "",
    );
  },
);

export const generatorProcedure = markAsDirectWriter(
  async (
    env: Env,
    args: Form,
    ...block: Form[]
  ): Promise<JsSrc | TranspileError> => {
    return await buildProcedure(
      "generatorProcedure",
      env,
      args,
      block,
      { isAsync: false, isGenerator: true },
      "function*",
      "",
    );
  },
);

export const _cu$yield = markAsDirectWriter(
  async (
    env: Env,
    a: Form,
    ...unused: Form[]
  ): Promise<JsSrc | TranspileError> => {
    if (!EnvF.isInGeneratorContext(env)) {
      return new TranspileError(
        "`yield` must be used in a generator function!",
      );
    }
    return transpiling1Unmarked("yield", (s: JsSrc) => `yield ${s}`)(
      env,
      a,
      ...unused,
    );
  },
  ordinaryStatement,
);

export const text = markAsDirectWriter(
  async (env: Env, ...args: Form[]): Promise<JsSrc | TranspileError> => {
    const esc = (s: string): string => s.replace(/[$`\\]/g, "\\$&");

    let result = "`";
    for (const arg of args) {
      if (typeof arg === "string") {
        result = `${result}${esc(arg)}`;
        continue;
      }
      const r = await transpileExpression(arg, env);
      if (TranspileError.is(r)) {
        return r;
      }
      result = `${result}\${${r}}`;
    }
    return `${result}\``;
  },
);

export const Map = constructorFor("Map", 1);

export const RegExp = constructorFor("RegExp", 2);

export const cu$thisFile = markAsDynamicVar(
  async ({
    transpileState: { srcPath },
  }: Env): Promise<JsSrc | TranspileError> => {
    const srcFullPath = path.resolve(srcPath);
    if ((await fs.stat(srcFullPath)).isDirectory()) {
      return new TranspileError(
        `${srcFullPath} is a directory! \`cu$thisFile\` is only allowed in a file`,
      );
    }
    return JSON.stringify(srcFullPath);
  },
);

export const cu$directoryOfThisFile = markAsDynamicVar(
  async ({
    transpileState: { srcPath },
  }: Env): Promise<JsSrc | TranspileError> => {
    const srcFullPath = path.resolve(srcPath);
    if ((await fs.stat(srcFullPath)).isDirectory()) {
      return JSON.stringify(srcFullPath);
    }
    return JSON.stringify(path.dirname(srcFullPath));
  },
);
