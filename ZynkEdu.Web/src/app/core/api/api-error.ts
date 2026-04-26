export function extractApiErrorMessage(error: unknown, fallback: string): string {
    const problem = error as {
        error?: {
            detail?: string;
            title?: string;
            message?: string;
            errors?: Record<string, string[] | string>;
        };
        message?: string;
    };

    const details = problem?.error?.errors;
    if (details && typeof details === 'object') {
        const messages = Object.entries(details)
            .flatMap(([key, value]) => {
                const items = Array.isArray(value) ? value : [value];
                return items
                    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
                    .map((item) => `${key}: ${item}`);
            })
            .filter((item) => item.trim().length > 0);

        if (messages.length > 0) {
            return messages.join(' | ');
        }
    }

    return problem?.error?.detail
        ?? problem?.error?.title
        ?? problem?.error?.message
        ?? problem?.message
        ?? fallback;
}
