import { computeTimeline, CoverSpecSchema, VideoSpecSchema, type CoverSpec, type VideoSpec } from '@tiresias/core';
import React from 'react';
import { Composition, Still } from 'remotion';
import { Cover, type CoverProps } from './cover';
import { CourtVision, type CourtVisionProps } from './court-vision';
import { SAMPLE_COVER, SAMPLE_SPEC_ANTI, SAMPLE_SPEC_TIRESIAS } from './samples';

const calcVideo = ({ props }: { props: CourtVisionProps }) => {
  const spec: VideoSpec = VideoSpecSchema.parse(props.spec);
  return { durationInFrames: computeTimeline(spec).durationInFrames, fps: spec.fps, props: { spec } };
};
// Stills default to fps 1; use 30 so the clip backdrop can seek to the exact freeze frame.
const calcCover = ({ props }: { props: CoverProps }) => ({ fps: 30, props: { cover: CoverSpecSchema.parse(props.cover) as CoverSpec } });

export const COMPOSITION_IDS = {
  tiresias: 'TiresiasCourtVision',
  antitiresias: 'AntiTiresiasNegativeCourtVision',
  tiresiasCover: 'TiresiasCover',
  antitiresiasCover: 'AntiTiresiasCover',
} as const;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id={COMPOSITION_IDS.tiresias} component={CourtVision} width={1080} height={1920} fps={30} durationInFrames={660} defaultProps={{ spec: SAMPLE_SPEC_TIRESIAS }} calculateMetadata={calcVideo} />
    <Composition id={COMPOSITION_IDS.antitiresias} component={CourtVision} width={1080} height={1920} fps={30} durationInFrames={660} defaultProps={{ spec: SAMPLE_SPEC_ANTI }} calculateMetadata={calcVideo} />
    <Still id={COMPOSITION_IDS.tiresiasCover} component={Cover} width={1080} height={1920} defaultProps={{ cover: SAMPLE_COVER }} calculateMetadata={calcCover} />
    <Still id={COMPOSITION_IDS.antitiresiasCover} component={Cover} width={1080} height={1920} defaultProps={{ cover: { ...SAMPLE_COVER, brand: 'antitiresias', seriesTitle: 'NEGATIVE COURT VISION', statLabel: 'TURNOVERS LAST NIGHT', headline: 'SEE ABSOLUTELY NOTHING' } }} calculateMetadata={calcCover} />
  </>
);
