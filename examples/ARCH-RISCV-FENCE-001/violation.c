/* ARCH-RISCV-FENCE-001 violating example. */

void publish_descriptor(unsigned *ready, unsigned *descriptor)
{
    *ready = 1U;
    *descriptor = 1U;
}
