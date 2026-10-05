import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Tan means "you can act here" and always carries navy text (8.7:1).
// Focus uses the global navy outline from globals.css.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent font-semibold whitespace-nowrap transition-[background-color,box-shadow,transform] select-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default:
          "bg-tan text-navy hover:shadow-[inset_0_0_0_2px_var(--color-navy)]",
        outline:
          "border-navy bg-paper text-navy hover:bg-bay aria-expanded:bg-bay",
        secondary: "bg-navy text-paper hover:shadow-[inset_0_0_0_2px_var(--color-primer)]",
        ghost: "text-navy hover:bg-bay aria-expanded:bg-bay",
        destructive: "border-warn bg-paper text-warn hover:bg-bay",
        link: "h-auto px-0 text-navy underline underline-offset-4 decoration-primer hover:decoration-navy",
      },
      size: {
        default: "h-11 px-4 text-[15px]",
        sm: "h-9 px-3 text-sm",
        lg: "h-12 px-5 text-base",
        icon: "size-11",
        "icon-sm": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
