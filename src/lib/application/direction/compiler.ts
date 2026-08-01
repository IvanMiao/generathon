import type {
  AudiovisualContract,
  DirectorTreatment,
  FilmBible,
  VisualScoreSegment,
} from "@/lib/domain/direction";
import type {
  MusicAnalysisRevision,
  MusicReading,
} from "@/lib/domain/music";

export interface DirectionCompilation {
  musicReading: MusicReading;
  treatments: DirectorTreatment[];
  selectedTreatment: DirectorTreatment;
  filmBible: FilmBible;
  audiovisualContract: AudiovisualContract;
  visualScore: VisualScoreSegment[];
}

export interface CompileDirectionOptions {
  selectedTreatmentId?: string;
}

/**
 * Provider-neutral directing boundary. A future structured-output adapter can
 * implement these same stages without exposing model payloads to the domain.
 */
export interface DirectionCompiler {
  compileMusicReading(
    analysisRevision: MusicAnalysisRevision,
  ): Promise<MusicReading>;
  compileTreatments(musicReading: MusicReading): Promise<DirectorTreatment[]>;
  compileFilmBible(selectedTreatment: DirectorTreatment): Promise<FilmBible>;
  compileAudiovisualContract(
    musicReading: MusicReading,
    filmBible: FilmBible,
  ): Promise<AudiovisualContract>;
  compileVisualScore(
    audiovisualContract: AudiovisualContract,
  ): Promise<VisualScoreSegment[]>;
  compileDirection(
    analysisRevision: MusicAnalysisRevision,
    options?: CompileDirectionOptions,
  ): Promise<DirectionCompilation>;
}
