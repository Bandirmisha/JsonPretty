import type { ReactNode } from 'react'
import { ChevronsDownUp, Sparkles } from 'lucide-react'

type Props = {
    onPretty: () => void
    onMinify: () => void
    children?: ReactNode
}

export default function ActionBar({ onPretty, onMinify, children }: Props) {
    return (
        <div className="center">
            <div className="center-actions">
                <button id="prettyBtn" type="button" className="with-icon" onClick={onPretty}>
                    <Sparkles size={16} />
                    Pretty
                </button>
                <button type="button" className="with-icon" onClick={onMinify}>
                    <ChevronsDownUp size={16} />
                    Minify
                </button>
            </div>

            {children && <div className="center-bottom">{children}</div>}
        </div>
    )
}
