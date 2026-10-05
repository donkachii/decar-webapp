import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-primer bg-paper px-3 text-base text-navy transition-colors placeholder:text-primer focus-visible:border-navy disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-warn",
        className
      )}
      {...props}
    />
  )
}

export { Input }
