export type ClubId = string;

export interface Archive {
  myData: {
    accountData?: {
      userId?: string;
      userName?: string;
    };
    activityData: {
      roundCount?: number;
      rounds: Array<{
        id: string;
        timestamp: number;
        clubId?: { id?: string };
        score?: number;
        strokes?: number;
        holeStrokes?: number[];
        stats?: {
          aces?: number;
          doubleEagleOrBetter?: number;
          eagles?: number;
          birdies?: number;
          pars?: number;
          bogeys?: number;
          doubleBogeyOrWorse?: number;
          fairwayLefts?: number;
          fairwayMiddles?: number;
          fairwayRights?: number;
          fairwayShorts?: number;
          fairwayLongs?: number;
          fairwayHoleCount?: number;
          gir?: number;
          girLefts?: number;
          girRights?: number;
          girShorts?: number;
          girLongs?: number;
          girNoChances?: number;
          girHoleCount?: number;
          putts?: number;
        };
      }>;
    };
    clubData?: {
      playedClubs?: Array<{ clubId: string; name: string }>;
    };
  };
}

export interface RoundRef {
  id: string;
  timestamp: number;
  timestampIso: string;
  clubId: ClubId | null;
  clubName: string | null;
  strokes: number | null;
  score: number | null;
}

export interface WrappedSummaryV1 {
  schemaVersion: "1";
  generatedAt: string;
  profile: {
    userId: string | null;
    userName: string | null;
  };
  rounds: {
    totalFromArchive: number | null;
    totalIncluded: number;
    byMonthUtc: Record<string, number>;
    firstRoundAt: string | null;
    lastRoundAt: string | null;
  };
  strokes: {
    average: number | null;
    bestRound: RoundRef | null;
    worstRound: RoundRef | null;
  };
  score: {
    average: number | null;
    bestRound: RoundRef | null;
    worstRound: RoundRef | null;
  };
  statsTotals: {
    birdies: number;
    pars: number;
    bogeys: number;
    doubleBogeyOrWorse: number;
    putts: number;
    puttsAvgPerRoundWithPutts: number | null;
    fairwayHitRate: number | null;
    girRate: number | null;
  };
  courses: {
    mostPlayed: {
      clubId: ClubId;
      name: string | null;
      roundsPlayed: number;
    } | null;
    items: Array<{
      clubId: ClubId;
      name: string | null;
      roundsPlayed: number;
      avgStrokes: number | null;
      avgScore: number | null;
    }>;
  };
}

