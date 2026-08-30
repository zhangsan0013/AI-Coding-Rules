# Register Access Rules

Status: provisional

## Scope

Memory-mapped I/O, `volatile`, register side effects, read-modify-write operations, access
width, and hardware ordering requirements.

## Load when

Reading or writing peripheral registers or hardware control blocks.

## Project facts this module depends on

- The register address, access width, alignment, reset value, and side effects for each field.
- Whether a field is read-only, write-only, write-one-to-clear, write-one-to-set, clear-on-read,
  or subject to a posted-write or ordering requirement.
- The project-supported register definitions and barrier or synchronization primitives.

Record these from the target reference manual and errata in `PROJECT_RULES.md`.

## Rules

### EMB-MMIO-VOLATILE-001 [MUST]

Memory-mapped registers MUST be accessed through the project-supported volatile register
definition for that target.

- Applies when: Declaring, reading, writing, or wrapping a memory-mapped register or hardware control block.
- Rationale: Volatile preserves the compiler-visible accesses required by MMIO, while an unqualified or ad hoc definition can be optimized away or use the wrong register contract.
- Verification (agent): Inventory every MMIO access and match it to the project register definition. Pass when every access has a typed volatile definition whose address and access qualifiers match the target register map; artifact: MMIO inventory and source report.
- Verification (target): Using the `PROJECT_RULES.md` `mmio-access` configuration, compare declarations with the target register map and inspect disassembly for volatility-sensitive accesses. Pass when every emitted access is present at the documented address and the expected access count is observed for 100% of sampled reads/writes; artifact: map excerpt, disassembly, and configuration snapshot.
- Exceptions: A generated or vendor register header MAY be used only when its version, access qualifiers, and target match are recorded with owner and update/review condition.

Correct:

```c
typedef struct {
    volatile uint32_t status;
} uart_regs_t;

static uart_regs_t *const UART0 = (uart_regs_t *)UART0_BASE;
uint32_t read_status(void) { return UART0->status; }
```

Incorrect:

```c
uint32_t read_status(void)
{
    return *(uint32_t *)UART0_BASE; /* bypasses the project volatile definition */
}
```

### EMB-MMIO-RAM-SYNC-001 [MUST]

Ordinary shared RAM MUST use a synchronization primitive that establishes its required
atomicity and ordering; `volatile` alone MUST NOT be used as the synchronization protocol.

- Applies when: Sharing ordinary RAM between tasks, interrupt handlers, cores, DMA callbacks, or other execution contexts.
- Rationale: Volatile preserves individual compiler-visible accesses but does not make a read-modify-write atomic or establish a happens-before edge between a payload and its ready flag.
- Verification (agent): Inventory each shared-RAM object, its readers/writers, and the publication/consumption primitive. Pass when every handoff names an atomic, lock, critical-section, or equivalent ordering protocol and no `volatile`-only handoff remains; artifact: shared-memory matrix and source report.
- Verification (target): Using the `PROJECT_RULES.md` `shared-ram-handoff` configuration, run 1,000 producer/consumer handoffs including interrupt preemption and the protocol's documented contention or full/empty cases. Pass when every accepted payload is consumed once with matching data and no stale, torn, or duplicate payload occurs; artifact: sequence trace, assertion log, and configuration snapshot.
- Exceptions: A `volatile` qualifier MAY accompany a synchronization primitive, but it MUST NOT replace that primitive; an MMIO field is governed by `EMB-MMIO-VOLATILE-001`.

Correct:

```c
#include <stdatomic.h>
#include <stdint.h>

static atomic_uint payload;

void publish(uint32_t value)
{
    atomic_store_explicit(&payload, value, memory_order_release);
}

uint32_t consume(void)
{
    return atomic_load_explicit(&payload, memory_order_acquire);
}
```

Incorrect:

```c
#include <stdbool.h>
#include <stdint.h>

static volatile uint32_t payload;
static volatile bool payload_ready;

void publish(uint32_t value)
{
    payload = value;
    payload_ready = true; /* volatile does not publish the payload atomically */
}

bool consume(uint32_t *value)
{
    if (!payload_ready) {
        return false;
    }
    *value = payload;
    payload_ready = false;
    return true;
}
```

### EMB-MMIO-WIDTH-001 [MUST]

Each register access MUST use the width, alignment, and byte-order semantics documented for
that register; a cast MUST NOT be used to manufacture an unsupported access width.

- Applies when: Reading or writing registers, packed device descriptions, or bus windows.
- Rationale: An apparently equivalent wider or narrower access can trigger adjacent side effects, bus faults, or partial writes.
- Verification (agent): Match each register access expression and cast to the recorded width, alignment, and byte order. Pass when no cast manufactures an unsupported width and every split access cites a documented sequence; artifact: access-width table and static-analysis report.
- Verification (target): Using the `PROJECT_RULES.md` `mmio-width` configuration, inspect disassembly for width-sensitive accesses and test aligned, boundary, and adjacent-register cases. Pass when only documented bytes change and no bus fault or neighboring side effect occurs in 100% of cases; artifact: disassembly, register trace, and configuration snapshot.
- Exceptions: A wider or split access MAY be used only when hardware documentation defines its semantics and the adapter records owner, sequence, and review condition.

Correct:

```c
/* CTRL is documented as one 32-bit access. */
UART0->CTRL = CTRL_ENABLE_MASK;
```

Incorrect:

```c
*(uint8_t *)&UART0->CTRL = 1U; /* manufactures an unsupported byte access */
```

### EMB-MMIO-RMW-001 [MUST]

Read-modify-write MUST NOT be used on a register or field whose read or write has side
effects, unless the target documentation explicitly defines the operation as safe.

- Applies when: Updating control, status, interrupt, latch, or command registers, especially when multiple contexts can access them.
- Rationale: A read can clear or sample state, and a write can acknowledge or trigger state; an unverified read-modify-write can lose events or write back transient bits.
- Verification (agent): Find each `REG |= x`, `REG &= ~x`, and equivalent, then match it to the field side-effect table. Pass when no side-effectful register uses unapproved read-modify-write; artifact: RMW inventory and field classification.
- Verification (target): Using the `PROJECT_RULES.md` `mmio-rmw` configuration, exercise concurrent, repeated, and pending-event cases for each affected field. Pass when no event is cleared, triggered, or lost beyond the documented result in 100% of cases; artifact: register transaction trace, reference-manual citation, and configuration snapshot.
- Exceptions: A documented atomic set/clear alias or safe read-modify-write MAY be used only with its exact access protocol, owner, evidence, and review condition recorded.

Correct:

```c
/* STATUS_CLR is a write-one-to-clear alias; no side-effectful read occurs. */
UART0->STATUS_CLR = UART_STATUS_RX_OVERRUN;
```

Incorrect:

```c
UART0->STATUS |= UART_STATUS_RX_OVERRUN; /* reads and writes a side-effectful status */
```

### EMB-MMIO-RESERVED-001 [MUST]

Writes MUST preserve reserved and implementation-defined bits according to the target
reset and write-mask rules; code MUST NOT invent values for undocumented fields.

- Applies when: Writing full registers, reset values, configuration masks, or generated register structures.
- Rationale: Reserved bits can be checked, latch behavior, or future-compatible state; arbitrary writes can create silicon-dependent behavior.
- Verification (agent): Check each full-register write against a recorded reset value or writable-bit mask. Pass when every set/clear bit is defined or explicitly required and no reserved-preserve bit is changed; artifact: write-mask table and source report.
- Verification (target): Using the `PROJECT_RULES.md` `mmio-write-mask` configuration, compare initialization and recovery writes with the reference manual and errata, then trace the resulting register value. Pass when reserved bits equal the documented reset/preserve value after every write in 100% of writes; artifact: register trace, manual revision, and configuration snapshot.
- Exceptions: A full-register write MAY use a documented reset or required constant only when its complete bit semantics, owner, and review condition are recorded.

Correct:

```c
uint32_t value = UART0->CTRL;
value = (value & UART_CTRL_WRITABLE_MASK) | UART_CTRL_REQUIRED_RESERVED;
UART0->CTRL = value;
```

Incorrect:

```c
UART0->CTRL = 0xFFFFFFFFU; /* invents values for reserved bits */
```

### EMB-MMIO-ORDER-001 [MUST]

When hardware requires an order between ordinary memory and register accesses, the code
MUST use the project-approved barrier or completion operation at the documented boundary.

- Applies when: Publishing descriptors, enabling peripherals, acknowledging status, starting transfers, or disabling hardware after memory access.
- Rationale: Compiler ordering, CPU ordering, and peripheral completion are distinct; satisfying only one can expose stale descriptors or reorder control effects.
- Verification (agent): Enumerate each memory/MMIO producer-consumer boundary and match it to the approved barrier or completion primitive. Pass when the boundary sequence contains the required operation and no descriptor is enabled before its writes; artifact: ordering table and disassembly.
- Verification (target): Using the `PROJECT_RULES.md` `mmio-order` configuration, exercise each producer/consumer boundary at least 100 times with the recorded memory model, barrier primitive, and bus/register trace source, including reset and timeout paths. Pass when every trace shows the device observing the descriptor/control state in the documented order; artifact: configuration snapshot, bus/register trace, and disassembly.
- Exceptions: A barrier MAY be omitted only when target documentation and the project memory model prove an adjacent operation supplies it, with proof owner, boundary, and review condition recorded.

Correct:

```c
descriptor.length = length;
memory_barrier();
DMA0->START = DMA_START_GO; /* descriptor writes precede the device command */
```

Incorrect:

```c
DMA0->START = DMA_START_GO;
descriptor.length = length; /* command is issued before descriptor publication */
```

## Module examples

See the larger [compliant](../../examples/EMB-MMIO-VOLATILE-001/compliant.c) and
[violating](../../examples/EMB-MMIO-VOLATILE-001/violation.c) examples.

Correct:

```c
descriptor.length = length;
memory_barrier();
DMA0->START = DMA_START_GO; /* hardware sees descriptor writes first */
```

Incorrect:

```c
DMA0->START = DMA_START_GO;
descriptor.length = length; /* descriptor publication is reordered after enable */
```
