import { TRAVEL_MODES, type TravelMode } from '../types'
import { MODE_LABELS } from '../lib/travelTime'

const LIMIT_CHOICES = [15, 30, 45, 60, 90, 120]

interface Props {
  mode: TravelMode
  onModeChange: (mode: TravelMode) => void
  limitMinutes: number
  onLimitChange: (minutes: number) => void
  keyword: string
  onKeywordChange: (keyword: string) => void
  availableTags: string[]
  selectedTags: string[]
  onToggleTag: (tag: string) => void
}

export function SearchControls({
  mode,
  onModeChange,
  limitMinutes,
  onLimitChange,
  keyword,
  onKeywordChange,
  availableTags,
  selectedTags,
  onToggleTag,
}: Props) {
  return (
    <section className="panel controls">
      <div className="control-row">
        <span className="field-label">移動手段</span>
        <div className="chips">
          {TRAVEL_MODES.map((option) => (
            <button
              key={option}
              type="button"
              className={`chip ${option === mode ? 'selected' : ''}`}
              onClick={() => onModeChange(option)}
            >
              {MODE_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="control-row">
        <span className="field-label">所要時間の上限</span>
        <div className="chips">
          {LIMIT_CHOICES.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className={`chip ${minutes === limitMinutes ? 'selected' : ''}`}
              onClick={() => onLimitChange(minutes)}
            >
              {minutes >= 60 ? `${minutes / 60}時間` : `${minutes}分`}
            </button>
          ))}
        </div>
      </div>

      <div className="control-row">
        <span className="field-label">絞り込み</span>
        <div className="filter-row">
          <input
            className="input"
            type="search"
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            placeholder="施設名・住所・メモで絞り込む"
          />
          {availableTags.length > 0 && (
            <div className="chips">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`chip small ${selectedTags.includes(tag) ? 'selected' : ''}`}
                  onClick={() => onToggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
