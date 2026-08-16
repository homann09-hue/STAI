import { describe, expect, it } from "vitest";
import { parseSdmxCsv } from "@/lib/macro/sdmx";

describe("SDMX-Veröffentlichungen und Revisionen", () => {
  it("behält Beobachtung, Erstveröffentlichung und aktuelle Revision getrennt", () => {
    const csv = [
      "TIME_PERIOD,OBS_VALUE,ACTION,VALID_FROM,VALID_TO",
      "2026-01,1.8,Replace,2026-02-10T10:00:00.000+01:00,2026-03-10T10:00:00.000+01:00",
      "2026-01,1.9,Replace,2026-03-10T10:00:00.000+01:00,",
      "2026-02,2.0,Replace,2026-03-10T10:00:00.000+01:00,"
    ].join("\n");

    expect(parseSdmxCsv(csv).observations).toEqual([
      {
        period: "2026-01",
        value: 1.9,
        releaseTime: "2026-02-10T09:00:00.000Z",
        vintageAsOf: "2026-03-10T09:00:00.000Z",
        initialValue: 1.8,
        revisionState: "revised"
      },
      {
        period: "2026-02",
        value: 2,
        releaseTime: "2026-03-10T09:00:00.000Z",
        vintageAsOf: "2026-03-10T09:00:00.000Z",
        initialValue: 2,
        revisionState: "unrevised"
      }
    ]);
  });

  it("behauptet ohne SDMX-Historienfelder keinen Revisionsstand", () => {
    expect(parseSdmxCsv("TIME_PERIOD,OBS_VALUE\n2026-01,1.8").observations)
      .toEqual([{ period: "2026-01", value: 1.8 }]);
  });
});
