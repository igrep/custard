import { describe, expect, test } from "vitest";

import { aVar, Env, TranspileError } from "./types.js";
import * as EnvF from "./env.js";

function inScope(env: Env, f: () => void): void {
  EnvF.push(env);
  f();
  EnvF.pop(env);
}

describe("Interactions of the functions in EnvF", () => {
  test("referTo returns the set variable, and logs the reference to the variable", () => {
    const env = EnvF.init(new Map());

    // Scope 0
    const v0_0v = aVar();
    EnvF.set(env, "v0_0", v0_0v);
    const w0_0 = EnvF.referTo(env, "v0_0");
    expect(w0_0).toBe(v0_0v);
    expect(env.r.m.get("v0_0")).toEqual([
      {
        r: [0],
        e: {
          s: [0],
          i: "v0_0",
        },
      },
    ]);

    const v0_1v = aVar();
    EnvF.set(env, "v0_1", v0_1v);

    // Scope 0-0
    inScope(env, () => {
      const w0_0 = EnvF.referTo(env, "v0_0");
      expect(w0_0).toBe(v0_0v);
      expect(env.r.m.get("v0_0")?.at(-1)).toEqual({
        r: [0, 0],
        e: {
          s: [0],
          i: "v0_0",
        },
      });

      const w0_1 = EnvF.referTo(env, "v0_1");
      expect(w0_1).toBe(v0_1v);
      expect(env.r.m.get("v0_1")).toEqual([
        {
          r: [0, 0],
          e: {
            s: [0],
            i: "v0_1",
          },
        },
      ]);

      const v00_0v = aVar();
      EnvF.set(env, "v00_0", v00_0v);

      // Scope 0-0-0
      inScope(env, () => {
        const w0_0 = EnvF.referTo(env, "v0_0");
        expect(w0_0).toBe(v0_0v);
        expect(env.r.m.get("v0_0")?.at(-1)).toEqual({
          r: [0, 0, 0],
          e: {
            s: [0],
            i: "v0_0",
          },
        });

        const w0_1 = EnvF.referTo(env, "v0_1");
        expect(w0_1).toBe(v0_1v);
        expect(env.r.m.get("v0_1")?.at(-1)).toEqual({
          r: [0, 0, 0],
          e: {
            s: [0],
            i: "v0_1",
          },
        });

        const w00_0 = EnvF.referTo(env, "v00_0");
        expect(w00_0).toBe(v00_0v);
        expect(env.r.m.get("v00_0")).toEqual([
          {
            r: [0, 0, 0],
            e: {
              s: [0, 0],
              i: "v00_0",
            },
          },
        ]);
      });

      // Scope 0-0-1
      inScope(env, () => {
        const w0_0 = EnvF.referTo(env, "v0_0");
        expect(w0_0).toBe(v0_0v);
        expect(env.r.m.get("v0_0")?.at(-1)).toEqual({
          r: [1, 0, 0],
          e: {
            s: [0],
            i: "v0_0",
          },
        });

        const w0_1 = EnvF.referTo(env, "v0_1");
        expect(w0_1).toBe(v0_1v);
        expect(env.r.m.get("v0_1")?.at(-1)).toEqual({
          r: [1, 0, 0],
          e: {
            s: [0],
            i: "v0_1",
          },
        });

        const w00_0 = EnvF.referTo(env, "v00_0");
        expect(w00_0).toBe(v00_0v);
        expect(env.r.m.get("v00_0")?.at(-1)).toEqual({
          r: [1, 0, 0],
          e: {
            s: [0, 0],
            i: "v00_0",
          },
        });
      });
    });

    // Scope 0-1
    inScope(env, () => {
      const w0_0 = EnvF.referTo(env, "v0_0");
      expect(w0_0).toBe(v0_0v);
      expect(env.r.m.get("v0_0")?.at(-1)).toEqual({
        r: [1, 0],
        e: {
          s: [0],
          i: "v0_0",
        },
      });

      const w0_1 = EnvF.referTo(env, "v0_1");
      expect(w0_1).toBe(v0_1v);
      expect(env.r.m.get("v0_1")?.at(-1)).toEqual({
        r: [1, 0],
        e: {
          s: [0],
          i: "v0_1",
        },
      });

      const v01_0v = aVar();
      EnvF.set(env, "v01_0", v01_0v);

      // Scope 0-1-0
      inScope(env, () => {
        const w0_0 = EnvF.referTo(env, "v0_0");
        expect(w0_0).toBe(v0_0v);
        expect(env.r.m.get("v0_0")?.at(-1)).toEqual({
          r: [0, 1, 0],
          e: {
            s: [0],
            i: "v0_0",
          },
        });

        const w0_1 = EnvF.referTo(env, "v0_1");
        expect(w0_1).toBe(v0_1v);
        expect(env.r.m.get("v0_1")?.at(-1)).toEqual({
          r: [0, 1, 0],
          e: {
            s: [0],
            i: "v0_1",
          },
        });

        const w01_0 = EnvF.referTo(env, "v01_0");
        expect(w01_0).toBe(v01_0v);
        expect(env.r.m.get("v01_0")).toEqual([
          {
            r: [0, 1, 0],
            e: {
              s: [1, 0],
              i: "v01_0",
            },
          },
        ]);
      });

      // Scope 0-1-1
      inScope(env, () => {
        const w0_0 = EnvF.referTo(env, "v0_0");
        expect(w0_0).toBe(v0_0v);
        expect(env.r.m.get("v0_0")?.at(-1)).toEqual({
          r: [1, 1, 0],
          e: {
            s: [0],
            i: "v0_0",
          },
        });

        const w0_1 = EnvF.referTo(env, "v0_1");
        expect(w0_1).toBe(v0_1v);
        expect(env.r.m.get("v0_1")?.at(-1)).toEqual({
          r: [1, 1, 0],
          e: {
            s: [0],
            i: "v0_1",
          },
        });

        const w01_0 = EnvF.referTo(env, "v01_0");
        expect(w01_0).toBe(v01_0v);
        expect(env.r.m.get("v01_0")?.at(-1)).toEqual({
          r: [1, 1, 0],
          e: {
            s: [1, 0],
            i: "v01_0",
          },
        });
      });
    });

    // Scope 0-2
    inScope(env, () => {
      const w0_0 = EnvF.referTo(env, "v0_0");
      expect(w0_0).toBe(v0_0v);
      expect(env.r.m.get("v0_0")?.at(-1)).toEqual({
        r: [2, 0],
        e: {
          s: [0],
          i: "v0_0",
        },
      });

      const w0_1 = EnvF.referTo(env, "v0_1");
      expect(w0_1).toBe(v0_1v);
      expect(env.r.m.get("v0_1")?.at(-1)).toEqual({
        r: [2, 0],
        e: {
          s: [0],
          i: "v0_1",
        },
      });

      const v02_0v = aVar();
      EnvF.set(env, "v02_0", v02_0v);

      // Scope 0-2-0
      inScope(env, () => {
        const w0_0 = EnvF.referTo(env, "v0_0");
        expect(w0_0).toBe(v0_0v);
        expect(env.r.m.get("v0_0")?.at(-1)).toEqual({
          r: [0, 2, 0],
          e: {
            s: [0],
            i: "v0_0",
          },
        });

        const w0_1 = EnvF.referTo(env, "v0_1");
        expect(w0_1).toBe(v0_1v);
        expect(env.r.m.get("v0_1")?.at(-1)).toEqual({
          r: [0, 2, 0],
          e: {
            s: [0],
            i: "v0_1",
          },
        });

        const w01_0 = EnvF.referTo(env, "v02_0");
        expect(w01_0).toBe(v02_0v);
        expect(env.r.m.get("v02_0")).toEqual([
          {
            r: [0, 2, 0],
            e: {
              s: [2, 0],
              i: "v02_0",
            },
          },
        ]);
      });

      // Scope 0-2-1
      inScope(env, () => {
        const w0_0 = EnvF.referTo(env, "v0_0");
        expect(w0_0).toBe(v0_0v);
        expect(env.r.m.get("v0_0")?.at(-1)).toEqual({
          r: [1, 2, 0],
          e: {
            s: [0],
            i: "v0_0",
          },
        });

        const w0_1 = EnvF.referTo(env, "v0_1");
        expect(w0_1).toBe(v0_1v);
        expect(env.r.m.get("v0_1")?.at(-1)).toEqual({
          r: [1, 2, 0],
          e: {
            s: [0],
            i: "v0_1",
          },
        });

        const w01_0 = EnvF.referTo(env, "v02_0");
        expect(w01_0).toBe(v02_0v);
        expect(env.r.m.get("v02_0")?.at(-1)).toEqual({
          r: [1, 2, 0],
          e: {
            s: [2, 0],
            i: "v02_0",
          },
        });
      });

      // Scope 0-2-2
      inScope(env, () => {
        const w0_0 = EnvF.referTo(env, "v0_0");
        expect(w0_0).toBe(v0_0v);
        expect(env.r.m.get("v0_0")?.at(-1)).toEqual({
          r: [2, 2, 0],
          e: {
            s: [0],
            i: "v0_0",
          },
        });

        const w0_1 = EnvF.referTo(env, "v0_1");
        expect(w0_1).toBe(v0_1v);
        expect(env.r.m.get("v0_1")?.at(-1)).toEqual({
          r: [2, 2, 0],
          e: {
            s: [0],
            i: "v0_1",
          },
        });

        const w01_0 = EnvF.referTo(env, "v02_0");
        expect(w01_0).toBe(v02_0v);
        expect(env.r.m.get("v02_0")?.at(-1)).toEqual({
          r: [2, 2, 0],
          e: {
            s: [2, 0],
            i: "v02_0",
          },
        });

        const v022_0v = aVar();
        EnvF.set(env, "v022_0", v022_0v);

        const w022_0 = EnvF.referTo(env, "v022_0");
        expect(w022_0).toBe(v022_0v);
        expect(env.r.m.get("v022_0")?.at(-1)).toEqual({
          r: [2, 2, 0],
          e: {
            s: [2, 2, 0],
            i: "v022_0",
          },
        });
      });
    });
  });

  describe("set returns an error if the variable is referred to as an outer variable", () => {
    test("1: the variable is recursively referred", () => {
      const env = EnvF.init(new Map());

      expect(EnvF.set(env, "v0", aVar())).toBeUndefined();

      EnvF.referTo(env, "v0");
      expect(EnvF.set(env, "v1", aVar())).toBeUndefined();

      inScope(env, () => {
        EnvF.referTo(env, "v0");
        expect(EnvF.set(env, "v0", aVar())).toEqual(
          new TranspileError(
            "No variable `v0` is defined! NOTE: If you want to define `v0` recursively, wrap the declaration(s) with `recursive`.",
          ),
        );
      });
    });

    test("2: the variable is recursively referred in the inner scope", () => {
      const env = EnvF.init(new Map());

      expect(EnvF.set(env, "v0", aVar())).toBeUndefined();

      EnvF.referTo(env, "v0");
      expect(EnvF.set(env, "v1", aVar())).toBeUndefined();

      inScope(env, () => {
        inScope(env, () => {
          EnvF.referTo(env, "v0");
        });
        expect(EnvF.set(env, "v0", aVar())).toEqual(
          new TranspileError(
            "No variable `v0` is defined! NOTE: If you want to define `v0` recursively, wrap the declaration(s) with `recursive`.",
          ),
        );
      });
    });

    test("3: the variable is back-referred", () => {
      const env = EnvF.init(new Map());

      expect(EnvF.set(env, "v0", aVar())).toBeUndefined();

      EnvF.referTo(env, "v0");
      expect(EnvF.set(env, "v1", aVar())).toBeUndefined();

      inScope(env, () => {
        EnvF.referTo(env, "v1");
        expect(EnvF.set(env, "v0", aVar())).toBeUndefined();

        expect(EnvF.set(env, "v1", aVar())).toEqual(
          new TranspileError(
            "No variable `v1` is defined! NOTE: If you want to define `v1` recursively, wrap the declaration(s) with `recursive`.",
          ),
        );

        inScope(env, () => {
          EnvF.referTo(env, "v1");
          expect(EnvF.set(env, "v0", aVar())).toBeUndefined();

          expect(EnvF.set(env, "v1", aVar())).toEqual(
            new TranspileError(
              "No variable `v1` is defined! NOTE: If you want to define `v1` recursively, wrap the declaration(s) with `recursive`.",
            ),
          );
        });
      });
    });

    test("4: the variable is back-referred in the inner scope", () => {
      const env = EnvF.init(new Map());

      expect(EnvF.set(env, "v0", aVar())).toBeUndefined();

      EnvF.referTo(env, "v0");
      expect(EnvF.set(env, "v1", aVar())).toBeUndefined();

      inScope(env, () => {
        inScope(env, () => {
          EnvF.referTo(env, "v1");
        });
        expect(EnvF.set(env, "v0", aVar())).toBeUndefined();

        expect(EnvF.set(env, "v1", aVar())).toEqual(
          new TranspileError(
            "No variable `v1` is defined! NOTE: If you want to define `v1` recursively, wrap the declaration(s) with `recursive`.",
          ),
        );

        inScope(env, () => {
          inScope(env, () => {
            EnvF.referTo(env, "v1");
          });
          expect(EnvF.set(env, "v0", aVar())).toBeUndefined();

          expect(EnvF.set(env, "v1", aVar())).toEqual(
            new TranspileError(
              "No variable `v1` is defined! NOTE: If you want to define `v1` recursively, wrap the declaration(s) with `recursive`.",
            ),
          );
        });
      });
    });
  });

  test("set returns undefined if the variable is referred to *not* actually as an outer variable", () => {
    const env = EnvF.init(new Map());

    expect(EnvF.set(env, "v0", aVar())).toBeUndefined();

    EnvF.referTo(env, "v0");
    expect(EnvF.set(env, "v1", aVar())).toBeUndefined();

    inScope(env, () => {
      expect(EnvF.set(env, "v0", aVar())).toBeUndefined();

      EnvF.referTo(env, "v0");
      expect(EnvF.set(env, "v1", aVar())).toBeUndefined();

      inScope(env, () => {
        EnvF.referTo(env, "v1");
      });
      expect(EnvF.set(env, "v2", aVar())).toBeUndefined();
    });
  });
});