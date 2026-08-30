# RISC-V Architecture Rules

Status: provisional

## Scope

RISC-V-specific ABI, privilege, CSR, atomic, instruction, alignment, and memory-ordering
behavior independent of the selected RTOS and compiler. Exact ISA extensions, privilege
level, core, and ABI facts belong in `PROJECT_RULES.md`.

## Load when

Changing RISC-V-specific ABI behavior, privilege handling, CSRs, atomic operations,
barriers, or instructions.

## Project facts this module depends on

- The exact XLEN, ISA string, optional extensions, privilege levels, endianness, and trap
  delegation used by the target.
- The selected ABI, stack alignment, trap entry/return implementation, and interrupt model.
- The supported atomic widths, memory-ordering instructions, CSR permissions, and compiler
  target flags.

Record these in `PROJECT_RULES.md`; a RISC-V family name does not identify the available
extensions or privilege behavior.

## Rules

### ARCH-RISCV-ABI-001 [MUST]

Each exported function, object, or assembly boundary MUST conform to the one verified RISC-V
target boundary contract: XLEN, ABI, register convention, stack alignment, data layout, and
floating-point mode.

- Applies when: Writing assembly, exporting symbols, mixing object files, using ABI-sensitive attributes, or changing XLEN or floating-point settings.
- Rationale: An ABI mismatch can corrupt arguments, return values, callee-saved registers, or stack frames without a source-level type error.
- Verification (agent): Inventory each assembly/export boundary and compare XLEN, register convention, stack alignment, data layout, and floating-point mode with the selected ABI. Pass when all linked objects agree or a named adapter owns conversion; artifact: object-flag table and boundary report.
- Verification (target): Inspect flags/object metadata and run a cross-object call with integer, pointer, and floating-point values. Pass when arguments, return values, and callee-saved registers match the reference; artifact: metadata dump, disassembly, and test log.
- Exceptions: A different convention MAY be used only behind a reviewed adapter with both contracts, owner, conversion evidence, and review condition recorded.

Correct:

```c
/* Both objects are built for rv32imac with the recorded ilp32 ABI. */
#include <stdint.h>

extern uint32_t riscv_add(uint32_t left, uint32_t right);

uint32_t sum(uint32_t left, uint32_t right)
{
    return riscv_add(left, right);
}
```

Incorrect:

```c
/* The caller expects rv64/lp64, but the linked callee is rv32imac/ilp32. */
#include <stdint.h>

extern uint64_t riscv_add(uint64_t left, uint64_t right);
```

### ARCH-RISCV-TRAP-001 [MUST]

Trap entry, CSR save/restore, privilege transition, and trap return MUST preserve the exact
state required by the selected core, delegation, and interrupt model.

- Applies when: Implementing trap vectors, machine or supervisor handlers, context switches, fault handlers, or naked assembly stubs.
- Rationale: A trap is not an ordinary C call; losing status, cause, stack, or return state can re-enter at the wrong privilege or corrupt interrupted work.
- Verification (agent): Compare each trap stub with the selected ABI/privilege protocol and verify all required registers/CSRs are saved, restored, and returned through `mret`/`sret`. Pass when no required state is omitted; artifact: frame layout and assembly review.
- Verification (target): Test nested, delegated, synchronous, and interrupt traps against the privileged specification. Pass when execution resumes at the saved PC with required privilege/status bits unchanged; artifact: CSR/frame trace and target configuration.
- Exceptions: A replacement stub MAY be used only with complete saved-state/privilege proof, owner, and review condition recorded.

Correct:

```asm
trap_entry:
    csrrw sp, mscratch, sp
    SAVE_ALL_REQUIRED_CSRS_AND_GPRS sp  /* expands to the port's complete frame */
    csrr t0, mcause                     /* cause is captured in that frame */
    call trap_handler
    RESTORE_ALL_REQUIRED_CSRS_AND_GPRS sp
    csrrw sp, mscratch, sp
    mret
```

Incorrect:

```c
void trap_entry(void)
{
    return; /* does not restore the state required by mret/sret */
}
```

### ARCH-RISCV-FENCE-001 [MUST]

A RISC-V fence for a normal-memory ownership handoff MUST name the predecessor and successor sets and execute at that handoff boundary.

- Applies when: Publishing normal-memory data between harts, tasks, or interrupt contexts.
- Rationale: A fence with incomplete predecessor/successor sets or the wrong placement cannot establish the visibility required by the ownership transfer.
- Verification (agent): For each normal-memory handoff, record the final producer write, predecessor/successor sets, fence location, and first consumer read. Pass when the sets cover the handoff and the fence lies between those two accesses; artifact: normal-memory ordering table and disassembly.
- Verification (target): Using the exact ISA string, memory attributes, producer/consumer pair, and trace source recorded in `PROJECT_RULES.md` under `riscv-fence-normal`, exercise at least 100 handoffs including reset and timeout paths. Pass when every trace shows the payload visible before the consumer's first read; artifact: `PROJECT_RULES.md` snapshot, trace capture, and compiler flags.
- Exceptions: A synchronization wrapper MAY provide the fence only when its predecessor/successor sets, boundary, owner, evidence, and review condition are recorded.

Correct:

```c
payload->value = value;
__asm volatile("fence rw, rw" ::: "memory");
ready = 1U; /* consumer reads after this ownership boundary */
```

Incorrect:

```c
ready = 1U;
__asm volatile("fence rw, rw" ::: "memory");
payload->value = value; /* the final producer write is after the fence */
```

### ARCH-RISCV-FENCE-IO-001 [MUST]

A RISC-V fence for an I/O handoff MUST include the recorded device predecessor and successor sets.

- Applies when: Ordering normal-memory descriptors with MMIO or another device-visible transaction.
- Rationale: `fence rw, rw` does not state the I/O domain; omitting `io` can let a device observe a control transaction before its descriptor.
- Verification (agent): Inventory each CPU-to-device and device-to-CPU handoff and compare its fence sets with the documented device accesses. Pass when every device boundary names the required `io` predecessor or successor set; artifact: I/O ordering table and disassembly.
- Verification (target): Using the exact ISA string, device memory map, bus trace source, and descriptor/control sequence recorded in `PROJECT_RULES.md` under `riscv-fence-io`, exercise 100 handoffs in each direction. Pass when every trace shows descriptor/data visibility before the device command and device completion before CPU consumption; artifact: `PROJECT_RULES.md` snapshot, bus trace, and test log.
- Exceptions: A platform ordering primitive MAY replace `fence` only when the device specification, equivalent domains, owner, evidence, and review condition are recorded.

Correct:

```c
descriptor->length = length;
__asm volatile("fence rw, io" ::: "memory");
DEVICE->START = DEVICE_START_GO;
```

Incorrect:

```c
descriptor->length = length;
__asm volatile("fence rw, rw" ::: "memory"); /* I/O successor set is missing */
DEVICE->START = DEVICE_START_GO;
```

### ARCH-RISCV-FENCE-INSTR-001 [MUST]

A RISC-V instruction-fetch update MUST execute `fence.i` after the new instruction bytes are visible and before execution can fetch them.

- Applies when: Replacing code in RAM, loading a JIT/trampoline image, patching a vector, or changing executable instruction bytes.
- Rationale: Data visibility and instruction-fetch visibility are separate on RISC-V; a data fence alone does not invalidate the instruction stream.
- Verification (agent): Trace every writable-executable update from its final data store to the first possible fetch. Pass when `fence.i` follows the final store and precedes every execution path that can fetch the updated bytes; artifact: instruction-update control-flow report and disassembly.
- Verification (target): Using the exact hart count, cache configuration, writable-executable region, and instruction trace source recorded in `PROJECT_RULES.md` under `riscv-fence-instr`, patch and execute the region at least 100 times. Pass when every run executes the new bytes and no run executes stale bytes after the update; artifact: `PROJECT_RULES.md` snapshot, instruction trace, and patch log.
- Exceptions: A platform cache-maintenance API MAY encapsulate `fence.i` only when its instruction-visibility guarantee, owner, evidence, and review condition are recorded.

Correct:

```c
memcpy(code, replacement, replacement_size);
__asm volatile("fence rw, rw" ::: "memory");
__asm volatile("fence.i" ::: "memory");
call_patched_code();
```

Incorrect:

```c
memcpy(code, replacement, replacement_size);
__asm volatile("fence rw, rw" ::: "memory");
call_patched_code(); /* no instruction-fetch fence */
```

### ARCH-RISCV-ATOMIC-001 [MUST]

A RISC-V atomic or load-reserved/store-conditional operation MUST use an extension and width supported by the exact target and MUST satisfy its alignment requirements.

- Applies when: Using the A extension, compiler atomics, LR/SC loops, or atomic memory operations.
- Rationale: The ISA string, XLEN, supported widths, and alignment determine whether an atomic operation is available and correctly addressed.
- Verification (agent): Match each atomic operation and width to the recorded ISA extension/XLEN and inspect operand alignment. Pass when every operation is supported by the exact target and every operand meets its required alignment; artifact: ISA/atomic-width table and alignment report.
- Verification (target): Using the exact ISA string, XLEN, compiler flags, atomic widths, and alignment-fault setting recorded in `PROJECT_RULES.md` under `riscv-atomic-support`, exercise every supported width at aligned and boundary addresses. Pass when 100% of supported cases execute correctly and unsupported-width fixtures are rejected or use the documented fallback; artifact: `PROJECT_RULES.md` snapshot, compiler output, fault log, and disassembly.
- Exceptions: A compiler or library fallback MAY implement an unsupported instruction only when its target support, timing, owner, evidence, and review condition are recorded.

Correct:

```c
#include <stdatomic.h>

/* PROJECT_RULES.md records the A extension and a supported 32-bit width. */
_Alignas(4) static atomic_uint lock_word;

unsigned read_lock(void)
{
    return atomic_load_explicit(&lock_word, memory_order_relaxed);
}
```

Incorrect:

```c
#include <stdatomic.h>

unsigned read_unaligned(const unsigned char *bytes)
{
    /* The selected rv32 target has no documented 64-bit atomic width. */
    return atomic_load_explicit((const atomic_uint_least64_t *)(bytes + 1U),
                                memory_order_relaxed);
}
```

### ARCH-RISCV-ATOMIC-PROGRESS-001 [MUST]

Each RISC-V LR/SC or retryable atomic sequence MUST have a bounded retry count or return an explicit failure result.

- Applies when: Implementing LR/SC loops, compare-and-swap loops, or compiler atomics that may report retry failure.
- Rationale: Reservation loss under contention or interrupts can recur indefinitely; an explicit bound protects latency and recovery behavior.
- Verification (agent): Inspect every retry loop and enumerate all exits. Pass when each loop has a finite configured bound or a finite failure path that returns a documented result; artifact: retry control-flow report and latency budget table.
- Verification (target): Using the exact hart contention harness, interrupt load, retry bound, and failure status recorded in `PROJECT_RULES.md` under `riscv-atomic-progress`, run at least 1,000 contended attempts. Pass when every attempt succeeds within the configured bound or returns the documented failure, with no attempt exceeding the bound; artifact: `PROJECT_RULES.md` snapshot, retry trace, and status log.
- Exceptions: An unbounded retry MAY be used only when the project records a finite contention proof, worst-case latency budget, owner, and review condition.

Correct:

```c
#include <stdatomic.h>
#include <stdbool.h>

static atomic_uint lock_word;

bool try_lock(void)
{
    for (unsigned attempt = 0U; attempt < 8U; ++attempt) {
        unsigned expected = 0U;
        if (atomic_compare_exchange_weak_explicit(&lock_word, &expected, 1U,
                                                  memory_order_acquire,
                                                  memory_order_relaxed)) {
            return true;
        }
    }
    return false; /* bounded retry/failure path */
}
```

Incorrect:

```c
#include <stdatomic.h>

static atomic_uint lock_word;

void lock_forever(void)
{
    unsigned expected;
    do {
        expected = 0U;
    } while (!atomic_compare_exchange_weak(&lock_word, &expected, 1U));
    /* no retry bound or failure result */
}
```

### ARCH-RISCV-CSR-001 [MUST]

Each CSR access MUST be permitted by the selected privilege level and mode.

- Applies when: Reading or writing status, interrupt, trap, timer, performance, or vendor-specific CSRs.
- Rationale: CSR permissions vary by privilege level and implementation; an illegal access can trap or corrupt control flow.
- Verification (agent): Match every CSR access to the exact privilege/mode permission in the recorded CSR map. Pass when every access is legal for its execution mode or is guarded by a documented mode transition; artifact: CSR permission table and source report.
- Verification (target): Using the CSR map, privilege levels, delegation, and trap trace source recorded in `PROJECT_RULES.md` under `riscv-csr-privilege`, execute each intended access at least 100 times and each forbidden access once. Pass when intended accesses complete with the documented result and forbidden accesses trap through the documented cause without state corruption; artifact: `PROJECT_RULES.md` snapshot, CSR/trap trace, and privilege configuration.
- Exceptions: A machine-mode monitor MAY proxy a lower-mode access only when the proxy contract, owner, evidence, and review condition are recorded.

Correct:

```asm
/* PROJECT_RULES.md: this stub runs in M-mode and mstatus is M-mode readable. */
csrr t0, mstatus
```

Incorrect:

```asm
/* This function runs in U-mode; direct mstatus access is not permitted. */
csrw mstatus, t0
```

### ARCH-RISCV-CSR-MASK-001 [MUST]

A CSR write MUST preserve reserved and unowned bits of the destination CSR.

- Applies when: Updating a CSR field while other fields or reserved bits retain reset or hardware-owned values.
- Rationale: A full-value write can clear delegation, interrupt, or implementation-defined bits that the caller does not own.
- Verification (agent): Identify the owned mask for each CSR write and inspect the read/modify/write or field instruction sequence. Pass when every write changes only the owned mask and preserves all other bits; artifact: CSR field-mask table and disassembly.
- Verification (target): Using the CSR reset values, owned masks, and readback trace recorded in `PROJECT_RULES.md` under `riscv-csr-mask`, perform at least 100 writes with unrelated bits set. Pass when every readback preserves all unowned and reserved bits and changes only the requested field; artifact: `PROJECT_RULES.md` snapshot, CSR readback log, and reference-manual revision.
- Exceptions: A full CSR write MAY be used for a documented reset value only when the complete bit semantics, owner, evidence, and review condition are recorded.

Correct:

```c
uintptr_t current = csr_read(mstatus);
csr_write(mstatus, current | MSTATUS_MIE); /* changes only the owned bit */
```

Incorrect:

```c
csr_write(mstatus, MSTATUS_MIE); /* clears unrelated and reserved fields */
```

### ARCH-RISCV-CSR-SIDEFX-001 [MUST]

Code that accesses a CSR MUST account for every documented read or write side effect before using its value or issuing the next access.

- Applies when: Reading a clear-on-read, latch-on-read, write-one-to-clear, write-trigger, or vendor-specific CSR.
- Rationale: A side-effecting CSR is not an ordinary variable; an extra read or an unqualified write can lose an event or trigger an unintended action.
- Verification (agent): Compare each access sequence with the CSR's recorded side-effect semantics and trace all repeated reads/writes. Pass when the sequence consumes, clears, or triggers the CSR exactly as documented; artifact: CSR side-effect table and control-flow report.
- Verification (target): Using the CSR side-effect definition, event source, and trace capture recorded in `PROJECT_RULES.md` under `riscv-csr-sidefx`, inject at least 100 events and execute the access sequence. Pass when each event is observed exactly once and no write triggers an undocumented transition; artifact: `PROJECT_RULES.md` snapshot, CSR/event trace, and status log.
- Exceptions: A diagnostic read MAY be added only when the reference manual documents it as non-destructive and the scope, owner, evidence, and review condition are recorded.

Correct:

```c
/* PROJECT_RULES.md: CUSTOM_EVENT_CSR is clear-on-read. */
uintptr_t event = csr_read(CUSTOM_EVENT_CSR);
if (event != 0U) {
    handle_event(event);
}
```

Incorrect:

```c
/* The first read may clear CUSTOM_EVENT_CSR before the second read. */
if (csr_read(CUSTOM_EVENT_CSR) != 0U) {
    handle_event(csr_read(CUSTOM_EVENT_CSR));
}
```

## Module examples

See the larger [compliant](../../examples/ARCH-RISCV-FENCE-001/compliant.c) and
[violating](../../examples/ARCH-RISCV-FENCE-001/violation.c) examples.

Correct:

```c
#include <stdint.h>

uintptr_t saved = csr_read(mstatus);
csr_write(mstatus, saved | MSTATUS_MIE); /* preserves unrelated bits */
```

Incorrect:

```c
csr_write(mstatus, MSTATUS_MIE); /* clears privilege and delegation bits */
```
