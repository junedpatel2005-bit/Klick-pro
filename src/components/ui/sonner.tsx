import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-slate-950 group-[.toaster]:text-white group-[.toaster]:border-slate-800 group-[.toaster]:shadow-2xl group-[.toaster]:rounded-2xl group-[.toaster]:p-4",
          title: "group-[.toast]:text-white group-[.toast]:font-semibold group-[.toast]:text-sm",
          description: "group-[.toast]:text-slate-300 text-sm mt-1 leading-5",
          closeButton:
            "group-[.toast]:bg-transparent group-[.toast]:border-0 group-[.toast]:text-slate-400 group-[.toast]:hover:text-white",
          actionButton:
            "group-[.toast]:bg-transparent group-[.toast]:text-white group-[.toast]:font-semibold text-sm px-0 py-0 rounded-none hover:group-[.toast]:text-slate-300 transition",
          cancelButton:
            "group-[.toast]:bg-transparent group-[.toast]:text-slate-300 group-[.toast]:font-semibold text-sm px-0 py-0 rounded-none hover:group-[.toast]:text-white transition",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
