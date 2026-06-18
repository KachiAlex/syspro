import * as React from "react"
import { cn } from "@/lib/utils"

interface DropdownMenuProps {
  children: React.ReactNode;
}

interface DropdownMenuTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

interface DropdownMenuContentProps {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  forceMount?: boolean;
}

interface DropdownMenuItemProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

interface DropdownMenuSeparatorProps {
  className?: string;
}

const DropdownMenuContext = React.createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({
  isOpen: false,
  setIsOpen: () => {},
})

const DropdownMenu: React.FC<DropdownMenuProps> = ({ children }) => {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <DropdownMenuContext.Provider value={{ isOpen, setIsOpen }}>
      <div className="relative">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  )
}

const DropdownMenuTrigger: React.FC<DropdownMenuTriggerProps> = ({ children, asChild = false }) => {
  const { isOpen, setIsOpen } = React.useContext(DropdownMenuContext)

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: () => setIsOpen(!isOpen),
    })
  }

  return (
    <button onClick={() => setIsOpen(!isOpen)}>
      {children}
    </button>
  )
}

const DropdownMenuContent: React.FC<DropdownMenuContentProps> = ({ 
  children, 
  className,
  align = "end",
  forceMount = false 
}) => {
  const { isOpen, setIsOpen } = React.useContext(DropdownMenuContext)
  const contentRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, setIsOpen])

  if (!isOpen && !forceMount) return null

  const alignmentClasses = {
    start: "left-0",
    center: "left-1/2 transform -translate-x-1/2",
    end: "right-0"
  }

  return (
    <div
      ref={contentRef}
      className={cn(
        "absolute top-full mt-2 w-56 rounded-md border bg-white p-1 shadow-lg z-50",
        alignmentClasses[align],
        className
      )}
    >
      {children}
    </div>
  )
}

const DropdownMenuItem: React.FC<DropdownMenuItemProps> = ({ 
  children, 
  className,
  onClick 
}) => {
  const { setIsOpen } = React.useContext(DropdownMenuContext)

  const handleClick = () => {
    onClick?.()
    setIsOpen(false)
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100",
        className
      )}
    >
      {children}
    </div>
  )
}

const DropdownMenuSeparator: React.FC<DropdownMenuSeparatorProps> = ({ className }) => (
  <div className={cn("h-px bg-gray-200 my-1", className)} />
)

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
}
