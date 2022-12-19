import { ParseError } from "../grammar";
import { readBlock } from "../reader";
import { transpileBlock } from "../transpile";
import { Block, Env } from "../types";

// TODO: importで、普通のESModuleをEnvにマージできるようにする
export function readString(input: string, _env: Env): Block | ParseError {
  return readBlock(input);
}

export function evaluate(block: Block, env: Env): any | Error {
  return transpileBlock(block, env);
}