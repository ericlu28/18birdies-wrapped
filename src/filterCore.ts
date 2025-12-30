import type { Archive, ClubId, RoundRef } from "./types.js";

export function filterArchive(archive: Archive, startTs: number = 1735689600, endTs: number = 1767182399): Archive {
    const rounds = archive.myData.activityData.rounds ?? [];
    // print length of rounds.
    const filtered = rounds.filter((r) => r.timestamp >= startTs && r.timestamp <= endTs);

    // print length of filtered.

    const newArchive = archive;
    newArchive.myData.activityData.rounds = filtered;
    
    return newArchive;
}
