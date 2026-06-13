export type FilterOption<T> = { label: string; value: T };

export function uniqueSorted(values: string[]): string[] {
    return Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort((left, right) => left.localeCompare(right));
}

export function stringFilterOptions(values: string[], allLabel: string, allValue: string): FilterOption<string>[] {
    return [{ label: allLabel, value: allValue }, ...uniqueSorted(values).map((value) => ({ label: value, value }))];
}

export function keepSelection<T>(selected: T, options: FilterOption<T>[], fallback: T): T {
    return options.some((option) => option.value === selected) ? selected : fallback;
}

export function keepNullableSelection<T>(selected: T | null, options: FilterOption<T | null>[], fallback: T | null = null): T | null {
    return options.some((option) => option.value === selected) ? selected : fallback;
}
