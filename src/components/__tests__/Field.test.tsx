import { render, screen } from '@testing-library/react'
import { Field } from '../Field'

describe('Field component', () => {
  test('renders label and input', () => {
    render(<Field label="Test Label" />)
    expect(screen.getByLabelText('Test Label')).toBeInTheDocument()
  })

  test('renders hint text', () => {
    render(<Field label="Test Label" hint="This is a hint" />)
    expect(screen.getByText('This is a hint')).toBeInTheDocument()
  })

  test('renders error text and sets aria-invalid', () => {
    render(<Field label="Test Label" error="This is an error" />)
    expect(screen.getByText('This is an error')).toBeInTheDocument()
    const input = screen.getByLabelText('Test Label')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', `${input.id}-error`)
  })

  test('does not reference a hidden hint when an error is shown', () => {
    render(<Field label="Test Label" hint="This is a hint" error="This is an error" />)

    const input = screen.getByLabelText('Test Label')
    expect(screen.queryByText('This is a hint')).not.toBeInTheDocument()
    expect(input).toHaveAttribute('aria-describedby', `${input.id}-error`)
  })

  test('renders required indicator', () => {
    render(<Field label="Test Label" required />)
    const input = screen.getByLabelText('Test Label')
    expect(input).toBeRequired()
  })

  test('generates unique ids for two Fields with the same label', () => {
    render(
      <>
        <Field label="Amount" />
        <Field label="Amount" />
      </>
    )
    const inputs = screen.getAllByLabelText('Amount')
    expect(inputs).toHaveLength(2)
    expect(inputs[0].id).not.toBe(inputs[1].id)
  })
})
