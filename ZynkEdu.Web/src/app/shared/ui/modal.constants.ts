/** Dialog/drawer width styles — at least 45% of the viewport on typical screens. */
export const MODAL_DIALOG_STYLE = { width: 'min(96vw, max(45vw, 28rem))' } as const;

/** Large data modals (timetables, statements, library lists). */
export const MODAL_DIALOG_STYLE_WIDE = { width: 'min(98vw, max(75vw, 45vw))' } as const;
