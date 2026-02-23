export const validateStep = (step) => {
    // Check required keys
    const mandatoryKeys = ['id', 'order', 'lat', 'lng', 'title'];

    for (const key of mandatoryKeys) {
        if (!Object.prototype.hasOwnProperty.call(step, key)) {
            return {
                valid: false,
                error: `Step (ID: ${step.id || 'unknown'}) is missing key: ${key}`
            };
        }
    }

    // Type checks
    if (typeof step.id !== 'string') return { valid: false, error: 'id must be a string' };
    if (!Number.isInteger(step.order)) return { valid: false, error: 'order must be an integer' };
    if (typeof step.lat !== 'number') return { valid: false, error: 'lat must be a float' };
    if (typeof step.lng !== 'number') return { valid: false, error: 'lng must be a float' };
    if (typeof step.title !== 'string') return { valid: false, error: 'title must be a string' };

    return { valid: true };
};

export const validateTourSteps = (steps) => {
    if (!Array.isArray(steps)) {
        return { valid: false, error: 'Steps field is not an array' };
    }

    if (steps.length === 0) {
        return { valid: false, error: 'Tour must have at least one step' };
    }

    // Check sequential order
    // We expect steps to be ordered 1 to N, but let's just ensure they exist and are valid first.
    // Sorting by order could verify gaps, but we'll focus on individual integrity first.

    for (const step of steps) {
        const validation = validateStep(step);
        if (!validation.valid) {
            return validation;
        }
    }

    return { valid: true };
};
