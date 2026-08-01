import {
  AudiovisualContractSchema,
  DirectorTreatmentSchema,
  FilmBibleSchema,
  VisualScoreSegmentSchema,
  type AudiovisualContract,
  type DirectorTreatment,
  type FilmBible,
  type VisualScoreSegment,
} from "@/lib/domain/direction";
import {
  MusicAnalysisRevisionSchema,
  MusicReadingSchema,
  type MusicAnalysisRevision,
  type MusicReading,
} from "@/lib/domain/music";
import type { ProjectBundle } from "@/lib/domain/project";
import { parseProjectBundle } from "@/lib/domain/validation";
import type {
  CompileDirectionOptions,
  DirectionCompilation,
  DirectionCompiler,
} from "@/lib/application/direction/compiler";

export type RecordedDirectionErrorCode =
  | "recorded_direction_not_found"
  | "recorded_direction_relationship_invalid"
  | "recorded_selected_treatment_invalid";

export class RecordedDirectionError extends Error {
  readonly code: RecordedDirectionErrorCode;

  constructor(code: RecordedDirectionErrorCode, message: string) {
    super(message);
    this.name = "RecordedDirectionError";
    this.code = code;
  }
}

function latestRevision<T extends { revision: number }>(records: T[]) {
  return records.toSorted((left, right) => right.revision - left.revision)[0];
}

/**
 * Replays the canonical fixture as if it were a direction provider. It never
 * reads credentials, media, or MusicAnalysis measurements and performs no I/O
 * after construction.
 */
export class RecordedFixtureDirectionCompiler implements DirectionCompiler {
  readonly #fixture: ProjectBundle;

  constructor(fixture: unknown) {
    this.#fixture = parseProjectBundle(fixture);
  }

  async compileMusicReading(
    analysisRevision: MusicAnalysisRevision,
  ): Promise<MusicReading> {
    const revision = MusicAnalysisRevisionSchema.parse(analysisRevision);
    const recorded = latestRevision(
      this.#fixture.music_readings.filter(
        (reading) => reading.based_on_analysis_revision_id === revision.id,
      ),
    );
    if (!recorded) {
      throw new RecordedDirectionError(
        "recorded_direction_not_found",
        `No recorded Music Reading is available for analysis revision '${revision.id}'.`,
      );
    }
    return MusicReadingSchema.parse(recorded);
  }

  async compileTreatments(
    musicReading: MusicReading,
  ): Promise<DirectorTreatment[]> {
    const reading = MusicReadingSchema.parse(musicReading);
    const recorded = this.#fixture.director_treatments.filter(
      (treatment) => treatment.music_reading_id === reading.id,
    );
    if (recorded.length === 0) {
      throw new RecordedDirectionError(
        "recorded_direction_not_found",
        `No recorded Director Treatments are available for Music Reading '${reading.id}'.`,
      );
    }
    return DirectorTreatmentSchema.array().min(2).parse(recorded);
  }

  async compileFilmBible(
    selectedTreatment: DirectorTreatment,
  ): Promise<FilmBible> {
    const treatment = DirectorTreatmentSchema.parse(selectedTreatment);
    if (treatment.status !== "selected") {
      throw new RecordedDirectionError(
        "recorded_selected_treatment_invalid",
        `Director Treatment '${treatment.id}' must be selected before compiling a Film Bible.`,
      );
    }
    const recorded = latestRevision(
      this.#fixture.film_bibles.filter(
        (filmBible) => filmBible.treatment_id === treatment.id,
      ),
    );
    if (!recorded) {
      throw new RecordedDirectionError(
        "recorded_direction_not_found",
        `No recorded Film Bible is available for Director Treatment '${treatment.id}'.`,
      );
    }
    return FilmBibleSchema.parse(recorded);
  }

  async compileAudiovisualContract(
    musicReading: MusicReading,
    filmBible: FilmBible,
  ): Promise<AudiovisualContract> {
    const reading = MusicReadingSchema.parse(musicReading);
    const bible = FilmBibleSchema.parse(filmBible);
    const recorded = latestRevision(
      this.#fixture.audiovisual_contracts.filter(
        (contract) =>
          contract.music_reading_id === reading.id &&
          contract.film_bible_id === bible.id,
      ),
    );
    if (!recorded) {
      throw new RecordedDirectionError(
        "recorded_direction_not_found",
        `No recorded Audiovisual Contract links Music Reading '${reading.id}' and Film Bible '${bible.id}'.`,
      );
    }
    return AudiovisualContractSchema.parse(recorded);
  }

  async compileVisualScore(
    audiovisualContract: AudiovisualContract,
  ): Promise<VisualScoreSegment[]> {
    const contract = AudiovisualContractSchema.parse(audiovisualContract);
    const recorded = this.#fixture.visual_score_segments.filter(
      (segment) => segment.audiovisual_contract_id === contract.id,
    );
    if (recorded.length === 0) {
      throw new RecordedDirectionError(
        "recorded_direction_not_found",
        `No recorded Visual Score is available for Audiovisual Contract '${contract.id}'.`,
      );
    }
    return VisualScoreSegmentSchema.array().min(5).max(7).parse(recorded);
  }

  async compileDirection(
    analysisRevision: MusicAnalysisRevision,
    options: CompileDirectionOptions = {},
  ): Promise<DirectionCompilation> {
    const musicReading = await this.compileMusicReading(analysisRevision);
    const treatments = await this.compileTreatments(musicReading);
    const requestedTreatmentId =
      options.selectedTreatmentId ?? this.#fixture.project.active_treatment_id;
    const selectedTreatment = requestedTreatmentId
      ? treatments.find((treatment) => treatment.id === requestedTreatmentId)
      : treatments.find((treatment) => treatment.status === "selected");

    if (!selectedTreatment || selectedTreatment.status !== "selected") {
      throw new RecordedDirectionError(
        "recorded_selected_treatment_invalid",
        "The requested recorded Director Treatment is missing or is not selected.",
      );
    }

    const filmBible = await this.compileFilmBible(selectedTreatment);
    if (filmBible.treatment_id !== selectedTreatment.id) {
      throw new RecordedDirectionError(
        "recorded_direction_relationship_invalid",
        "The recorded Film Bible does not belong to the selected Director Treatment.",
      );
    }
    const audiovisualContract = await this.compileAudiovisualContract(
      musicReading,
      filmBible,
    );
    const visualScore = await this.compileVisualScore(audiovisualContract);

    return {
      musicReading,
      treatments,
      selectedTreatment,
      filmBible,
      audiovisualContract,
      visualScore,
    };
  }
}
