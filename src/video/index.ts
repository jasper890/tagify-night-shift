// Entry point for the Remotion CLI (npm run video:studio / video:render). The website embeds Intro directly with @remotion/player.
import { registerRoot } from 'remotion'
import { RemotionRoot } from './Root'

registerRoot(RemotionRoot)
