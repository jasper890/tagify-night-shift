import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui'
import { Sprite } from '../components/pixel/Sprite'

export default function NotFound() {
  return (
    <>
      <PageHeader kicker="Error 404" title="This room is empty" intro="This page does not exist. Maybe the job was scheduled for a different day?" />
      <div className="flex flex-wrap items-center gap-5">
        <Sprite id="ghost" size={80} className="animate-bob" />
        <Link to="/" className="btn btn-amber no-underline">
          Back to the world map
        </Link>
      </div>
    </>
  )
}
