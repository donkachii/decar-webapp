import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-md border border-primer bg-paper px-3 py-2.5 text-base text-graphite transition-colors placeholder:text-primer focus-visible:border-graphite disabled:opacity-50 aria-invalid:border-warn",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
