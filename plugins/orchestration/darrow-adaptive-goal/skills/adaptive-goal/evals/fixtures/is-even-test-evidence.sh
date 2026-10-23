#!/usr/bin/env bash
set -eu

scratch=.git/eval-checks/is-even-evidence
mkdir -p "$scratch"
cat >"$scratch/loader.mjs" <<'JS'
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

const target = pathToFileURL(realpathSync("src/math.js"));

export async function load(url, context, nextLoad) {
  const original = new URL(url);
  const loaded = await nextLoad(url, context);
  if (original.pathname !== target.pathname || original.searchParams.has("darrowOriginal")) {
    return loaded;
  }
  original.searchParams.set("darrowOriginal", "1");
  const reference = JSON.stringify(original.href);
  return { ...loaded, source: `
    export * from ${reference};
    import { isEven as actual } from ${reference};
    export function isEven(value) {
      const result = actual(value);
      const variant = process.env.DARROW_EVAL_IS_EVEN_VARIANT;
      if (variant === "zero" && value === 0) return !result;
      if (variant === "negative-even" && Number.isInteger(value) && value < 0 && value % 2 === 0) return !result;
      if (variant === "odd" && Number.isInteger(value) && value % 2 !== 0) return !result;
      return result;
    }
  ` };
}
JS

for variant in original zero negative-even odd; do
  status=0
  DARROW_EVAL_IS_EVEN_VARIANT=$variant \
    node --experimental-loader "$PWD/$scratch/loader.mjs" --test test/math.test.js \
    >"$scratch/$variant.log" 2>&1 || status=$?
  if [ "$variant" = original ]; then
    [ "$status" -eq 0 ] || { cat "$scratch/$variant.log" >&2; exit 1; }
  elif [ "$status" -ne 1 ]; then
    printf 'Focused evidence did not reject the %s behavior mutation (exit %s)\n' "$variant" "$status" >&2
    exit 1
  fi
done
