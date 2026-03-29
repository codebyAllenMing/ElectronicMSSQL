type Props = {
    checked: boolean
    indeterminate?: boolean
    onChange: (checked: boolean) => void
}

export default function Checkbox({ checked, indeterminate = false, onChange }: Props): JSX.Element {
    return (
        <input
            type="checkbox"
            checked={checked}
            ref={(el) => {
                if (el) el.indeterminate = indeterminate
            }}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 accent-blue-500 cursor-pointer"
        />
    )
}
