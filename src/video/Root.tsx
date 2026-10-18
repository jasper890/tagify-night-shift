import { Composition } from 'remotion'
import { Intro, INTRO_DURATION } from './Intro'
import { FPS, HEIGHT, WIDTH } from './theme'

export function RemotionRoot() {
  return <Composition id="Intro" component={Intro} durationInFrames={INTRO_DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
}
