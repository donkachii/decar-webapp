import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Amber means "you can act here" and always carries graphite text (6.4:1).
// Focus uses the global graphite outline from globals.css.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent font-semibold whitespace-nowrap transition-[background-color,box-shadow,transform] select-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default:
          "bg-amber text-graphite hover:shadow-[inset_0_0_0_2px_var(--color-graphite)]",
        outline:
          "border-graphite bg-paper text-graphite hover:bg-bay aria-expanded:bg-bay",
        secondary: "bg-graphite text-paper hover:shadow-[inset_0_0_0_2px_var(--color-primer)]",
        ghost: "text-graphite hover:bg-bay aria-expanded:bg-bay",
        destructive: "border-warn bg-paper text-warn hover:bg-bay",
        link: "h-auto px-0 text-graphite underline underline-offset-4 decoration-primer hover:decoration-graphite",
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
