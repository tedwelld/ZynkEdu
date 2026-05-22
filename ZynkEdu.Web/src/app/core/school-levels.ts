export type SchoolLevel = 'ZGC Level' | "O'Level" | "A'Level" | 'General';

export const LEVEL_CODE_MAP: Record<string, string> = {
    'ZGC Level': 'ZGC',
    "O'Level": 'OL',
    "A'Level": 'AL',
    'General': ''
};

export function getLevelCode(level: string | null | undefined): string {
    const normalized = normalizeSchoolLevel(level ?? '');
    return LEVEL_CODE_MAP[normalized] ?? '';
}

export const SCHOOL_LEVEL_OPTIONS: { label: string; value: SchoolLevel; code: string }[] = [
    { label: 'All levels', value: 'General', code: '' },
    { label: 'ZGC Level [ZGC]', value: 'ZGC Level', code: 'ZGC' },
    { label: "O'Level [OL]", value: "O'Level", code: 'OL' },
    { label: "A'Level [AL]", value: "A'Level", code: 'AL' }
];

export const LEVEL_CLASS_MAP: Record<Exclude<SchoolLevel, 'General'>, string[]> = {
    'ZGC Level': ['Form 1A', 'Form 1B', 'Form 1C', 'Form 2A', 'Form 2B', 'Form 2C'],
    "O'Level": ['Form 3A Sciences', 'Form 3B Commercials', 'Form 3C Arts', 'Form 4A Sciences', 'Form 4B Commercials', 'Form 4C Arts'],
    "A'Level": ['Form 5 Arts', 'Form 5 Commercials', 'Form 5 Sciences', 'Form 6 Arts', 'Form 6 Commercials', 'Form 6 Sciences']
};

export function normalizeSchoolLevel(value: string | null | undefined): SchoolLevel {
    const trimmed = (value ?? '').trim();
    if (!trimmed) {
        return 'General';
    }

    if (trimmed === 'ZGC' || trimmed === 'ZGC Level' || trimmed === 'Form 1' || trimmed === 'Form 2') {
        return 'ZGC Level';
    }

    if (trimmed === 'OLevel' || trimmed === 'O Level' || trimmed === "O'Level" || trimmed === 'Form 3' || trimmed === 'Form 4') {
        return "O'Level";
    }

    if (trimmed === 'ALevel' || trimmed === 'A Level' || trimmed === "A'Level" || trimmed === 'Form 5' || trimmed === 'Form 6') {
        return "A'Level";
    }

    if (trimmed === 'General') {
        return 'General';
    }

    return trimmed as SchoolLevel;
}

export function getClassLevel(className: string): SchoolLevel | null {
    const trimmed = className.trim();
    for (const [level, classes] of Object.entries(LEVEL_CLASS_MAP)) {
        if (classes.some((entry) => entry.toLowerCase() === trimmed.toLowerCase())) {
            return level as Exclude<SchoolLevel, 'General'>;
        }
    }

    return null;
}

export function getClassesForLevel(level: string): string[] {
    const normalized = normalizeSchoolLevel(level);
    return normalized === 'General' ? [] : LEVEL_CLASS_MAP[normalized as Exclude<SchoolLevel, 'General'>] ?? [];
}

export function isSupportedSchoolLevel(level: string): boolean {
    const normalized = normalizeSchoolLevel(level);
    return normalized === 'General' || normalized in LEVEL_CLASS_MAP;
}
