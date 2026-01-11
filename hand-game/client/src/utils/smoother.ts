export class SmoothingAgent {
    private value: number = 0.5;
    private alpha: number = 0.1; // Smoothing factor (0.1 = very smooth, 0.9 = responsive)

    constructor(initialValue: number = 0.5, alpha: number = 0.1) {
        this.value = initialValue;
        this.alpha = alpha;
    }

    // Standard Exponential Moving Average
    update(newValue: number): number {
        this.value = this.value + this.alpha * (newValue - this.value);
        return this.value;
    }

    // Reset if needed (e.g. hand lost)
    reset(val: number) {
        this.value = val;
    }
}

// For more advanced smoothing (Dynamic Alpha based on speed)
export class DynamicSmoothingAgent {
    private value: number = 0.5;
    private minAlpha: number = 0.05;
    private maxAlpha: number = 0.6;

    constructor(initialValue: number = 0.5) {
        this.value = initialValue;
    }

    update(newValue: number): number {
        // Calculate distance (speed of change)
        const delta = Math.abs(newValue - this.value);

        // If moving fast, increase alpha to be responsive.
        // If moving slow (jitter), decrease alpha to be smooth.
        // Map delta 0.0 -> minAlpha, delta 0.2 -> maxAlpha
        let dynamicAlpha = this.minAlpha + (delta * 5);
        if (dynamicAlpha > this.maxAlpha) dynamicAlpha = this.maxAlpha;

        this.value = this.value + dynamicAlpha * (newValue - this.value);
        return this.value;
    }

    reset(val: number) {
        this.value = val;
    }
}
