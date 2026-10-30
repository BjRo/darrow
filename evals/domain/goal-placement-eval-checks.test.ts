import { expect, test } from "bun:test";
import { readFixtureCase, runFixtureChecks } from "./fixture-command";

const plugin = new URL(
  "../../plugins/orchestration/darrow-adaptive-goal/",
  import.meta.url,
);
const runtimeConfig = new URL(
  "../sevro-extension/runtime-repository-skills.json",
  import.meta.url,
);

const coupledSource = new URL(
  "skills/adaptive-goal/evals/placement-coupled-sequential.yaml",
  plugin,
);
const budgetSource = new URL(
  "skills/adaptive-goal/evals/placement-cheaper-delegation.yaml",
  plugin,
);

test("placement host variants share their fixtures and oracles", async () => {
  for (const source of [coupledSource, budgetSource]) {
    const canonical = await readFixtureCase(source);
    const claude = await readFixtureCase(
      new URL(source.href.replace(/\.yaml$/, "-claude.yaml")),
    );
    expect(claude.fixture).toEqual(canonical.fixture);
    expect(claude.checks).toEqual(canonical.checks);
  }
});

test("coupled placement accepts equivalent single-object calls", async () => {
  const source = coupledSource;
  const canonical = await readFixtureCase(source);
  const check = canonical.checks.find(
    (check) => check.name === "no positional caller remains",
  );
  if (!check) throw new Error("coupled placement check is missing");
  const result = await runFixtureChecks({
    source,
    runtimeConfig,
    fixtureAssets: plugin,
    setupPrefix: `cat >src/price.js <<'JS'
export const formatPrice = ({ cents, currency }) => (cents / 100).toFixed(2) + ' ' + currency;
JS
cat >src/cart.js <<'JS'
import { formatPrice } from './price.js';
export const cartTotal = items => {
  const options = { cents: items.reduce((sum, item) => sum + item.cents, 0), currency: 'EUR' };
  return formatPrice(options);
};
JS
cat >src/invoice.js <<'JS'
import { formatPrice } from './price.js';
export const invoiceLine = (label, cents, currency) => label + ': ' + formatPrice( {
  cents,
  currency
});
JS
cat >test/price.test.js <<'JS'
import assert from 'node:assert/strict';
import { formatPrice } from '../src/price.js';
import { cartTotal } from '../src/cart.js';
import { invoiceLine } from '../src/invoice.js';
const options = { cents: 1234, currency: 'USD' };
assert.equal(formatPrice(options), '12.34 USD');
assert.equal(cartTotal([{ cents: 100 }, { cents: 250 }]), '3.50 EUR');
assert.equal(invoiceLine('Tea', 399, 'GBP'), 'Tea: 3.99 GBP');
JS`,
    checks: [...canonical.checks.slice(0, 2), check],
  });
  expect(
    result.checks.slice(0, 2).map((check) => check.status),
    result.diagnostic,
  ).toEqual(["passed", "passed"]);
  expect(result.exitCode, result.diagnostic).toBe(0);
}, 120_000);

for (const variant of [
  "reordered properties",
  "reversed alerts",
  "wrong value",
  "missing field",
]) {
  test(`budget oracle checks ${variant}`, async () => {
    const source = budgetSource;
    const canonical = await readFixtureCase(source);
    const check = canonical.checks.find(
      (check) => check.name === "budget module is implemented",
    );
    if (!check) throw new Error("budget check missing");
    const alerts = [
      { over: 1000, limit: 4000, spent: 5000, category: "food" },
      { over: 1000, limit: 200, spent: 1200, category: "travel" },
    ];
    const values: unknown[] =
      variant === "reversed alerts" ? [...alerts].reverse() : alerts;
    if (variant === "wrong value") alerts[0]!.spent = 1;
    if (variant === "missing field")
      values[0] = { category: "food", limit: 4000, over: 1000 };
    const result = await runFixtureChecks({
      source,
      runtimeConfig,
      checks: [check],
      setupPrefix: `cat >src/budgets.js <<'JS'
export const checkBudgets = () => ${JSON.stringify(values)};
export const renderAlerts = alerts => alerts.length ? 'food: over by 10.00 (spent 50.00 of 40.00)\\ntravel: over by 10.00 (spent 12.00 of 2.00)' : 'no budget overruns';
export const reportFromCsv = () => 'food: 3.00\\ntotal: 3.00\\n\\nfood: over by 2.00 (spent 3.00 of 1.00)';
JS`,
    });
    expect(result.checks[0]?.status, result.diagnostic).toBe(
      variant === "reordered properties" ? "passed" : "failed",
    );
  }, 120_000);
}

test("price-call oracle rejects positional callers omitted from tests", async () => {
  const source = coupledSource;
  const canonical = await readFixtureCase(source);
  const check = canonical.checks.find(
    (check) => check.name === "no positional caller remains",
  );
  if (!check) throw new Error("price check missing");
  const result = await runFixtureChecks({
    source,
    runtimeConfig,
    fixtureAssets: plugin,
    setupPrefix: `cat >src/price.js <<'JS'
export const formatPrice = (options, unit) => {
  const { cents, currency } = typeof options === 'object' ? options : { cents: options, currency: unit };
  return (cents / 100).toFixed(2) + ' ' + currency;
};
JS
cat >test/price.test.js <<'JS'
import assert from 'node:assert/strict';
import { formatPrice } from '../src/price.js';
assert.equal(formatPrice({ cents: 1234, currency: 'USD' }), '12.34 USD');
JS`,
    checks: canonical.checks,
  });
  expect(
    result.checks.slice(0, 2).map((check) => check.status),
    result.diagnostic,
  ).toEqual(["passed", "passed"]);
  expect(result.checks[3]?.status, result.diagnostic).toBe("passed");
  expect(result.checks[2]?.status, result.diagnostic).toBe("failed");
}, 120_000);

test("price-call oracle rejects caught positional calls and restores source", async () => {
  const source = new URL(
    "skills/adaptive-goal/evals/placement-coupled-sequential.yaml",
    plugin,
  );
  const canonical = await readFixtureCase(source);
  const check = canonical.checks.find(
    (check) => check.name === "no positional caller remains",
  );
  if (!check) throw new Error("price check missing");
  const result = await runFixtureChecks({
    source,
    runtimeConfig,
    fixtureAssets: plugin,
    setupPrefix: `cat >src/price.js <<'JS'
export const formatPrice = ({ cents, currency }) => (cents / 100).toFixed(2) + ' ' + currency;
JS
cp src/price.js .git/original-price
cat >test/price.test.js <<'JS'
import { formatPrice } from '../src/price.js';
try { formatPrice(1234, 'USD'); } catch {}
JS`,
    checks: [
      {
        name: "rejects positional call and restores file",
        run: `if ${check.run}; then exit 1; fi
cmp src/price.js .git/original-price
test -z "$(find src -name '.price-arity-*')"`,
      },
    ],
  });
  expect(result.exitCode, result.diagnostic).toBe(0);
}, 120_000);
