# Constraint Demo

This is a small host-simulated C11 project initialized with the `bare-metal-c11`
profile. It implements a bounded counter with an explicit public status contract.

The project intentionally uses no hardware, RTOS, DMA, interrupt, or dynamic-allocation
features. Those areas remain outside the active rule baseline.

## Build and run

From this directory:

```powershell
gcc -std=c11 -Wall -Wextra -Werror -pedantic -Isrc src/counter.c src/main.c -o counter-demo.exe
.\counter-demo.exe
gcc -std=c11 -Wall -Wextra -Werror -pedantic -Isrc src/counter.c tests/test_counter.c -o counter-tests.exe
.\counter-tests.exe
```

Expected application output:

```text
counter=15
```

## Defensive contract under test

The defensive behavior below is supported by the public API contract and the project
convention that failed operations leave the counter unchanged. No speculative default,
retry, or recovery behavior is added.

Applied constraints: `CORE-CHG-DEFENSIVE-001`, `CORE-CORR-ERROR-001`,
`CORE-CORR-INVARIANT-001`, `C-API-ERROR-001`, and `C-API-NULL-001`.

| Trigger | Evidence | Expected behavior | Coverage |
| --- | --- | --- | --- |
| Add before initialization | `counter_add` requires initialized state | Return `COUNTER_STATUS_NOT_INITIALIZED`; do not update state | `tests/test_counter.c` |
| Null output pointer | `counter_read` documents a non-null output location | Return `COUNTER_STATUS_INVALID_ARGUMENT`; do not dereference | `tests/test_counter.c` |
| Zero-value boundary | `uint32_t` accepts zero and adding zero is a valid operation | Return success and preserve zero | `tests/test_counter.c` |
| Addition beyond `UINT32_MAX` | Counter range is defined by `uint32_t` | Return `COUNTER_STATUS_OVERFLOW`; do not wrap or mutate the value | `tests/test_counter.c` |
| Maximum-value read | The public read operation reports the stored value | Return success and preserve `UINT32_MAX` | `tests/test_counter.c` |

The active AI instructions are in `AGENTS.md`. The installed catalog and profile are
under `.ai-rules/`. The repository CLI can show the selected modules with:

```powershell
node ..\..\bin\ai-coding-rules.js resolve --profile bare-metal-c11 --signal public-interface --signal preprocessor
```
