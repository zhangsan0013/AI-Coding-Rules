/* ARCH-RISCV-FENCE-001 compliant example. */

extern void riscv_fence_rw_rw(void);

void publish_descriptor(unsigned *ready, unsigned *descriptor)
{
    *descriptor = 1U;
    riscv_fence_rw_rw();
    *ready = 1U;
}
