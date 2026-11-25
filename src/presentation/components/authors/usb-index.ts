/** Variables del índice de productividad Unisimón por tema, con su peso (suman 100). Las de peso 0 no cuentan y no se listan. */
export const USB_INDEX_GROUPS = [
  {
    key: 'hIndex',
    vars: [
      ['hLeadership', 15],
      ['hUsb', 8],
      ['hGeneral', 2],
    ],
  },
  {
    key: 'articles',
    vars: [
      ['q1Leadership', 12],
      ['q1', 10],
      ['q2Leadership', 8],
      ['q2', 7],
      ['q34Leadership', 6],
      ['q34', 3.5],
    ],
  },
  {
    key: 'impact',
    vars: [
      ['citations', 5.5],
      ['intlCoauthorship', 5],
      ['intlJournals', 3],
      ['openAccess', 3],
      ['english', 1.5],
    ],
  },
  {
    key: 'innovation',
    vars: [
      ['intlPatents', 2.5],
      ['nationalPatents', 1.5],
      ['patentApplications', 1],
      ['techDevelopment', 1],
    ],
  },
  {
    key: 'other',
    vars: [
      ['conferencePaper', 1.5],
      ['projects', 1],
      ['otherDocuments', 1],
      ['networks', 1],
    ],
  },
] as const;

/** Peso más alto: la barra de cada variable se mide contra él. */
export const USB_INDEX_MAX_WEIGHT = 15;

export const groupWeight = (vars: readonly (readonly [string, number])[]) =>
  vars.reduce((sum, [, w]) => sum + w, 0);
