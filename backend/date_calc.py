import calendar
import tkinter as tk
from collections import defaultdict
from datetime import date as date_cls
from datetime import datetime, timedelta
from tkinter import messagebox, ttk


class ComboDatePicker(ttk.Frame):
    def __init__(self, parent, initial_date=None):
        super().__init__(parent)
        today = initial_date or datetime.today().date()

        years = [str(y) for y in range(2019, 2027)]
        months = [str(m).zfill(2) for m in range(1, 13)]

        self.year_cb = ttk.Combobox(self, values=years, width=5, state="readonly")
        self.month_cb = ttk.Combobox(self, values=months, width=3, state="readonly")
        self.day_cb = ttk.Combobox(self, values=[], width=3, state="readonly")

        self.min_date = None
        self.max_date = None

        self.year_cb.grid(row=0, column=0, padx=(0, 2))
        self.month_cb.grid(row=0, column=1, padx=(0, 2))
        self.day_cb.grid(row=0, column=2)

        # Set initial values
        self.year_cb.set(str(today.year))
        self.month_cb.set(str(today.month).zfill(2))
        self._refresh_days()
        self.day_cb.set(str(today.day).zfill(2))

        # Update days when year/month change
        self.year_cb.bind("<<ComboboxSelected>>", lambda e: self._on_ym_change())
        self.month_cb.bind("<<ComboboxSelected>>", lambda e: self._on_ym_change())
        self.day_cb.bind("<<ComboboxSelected>>", lambda e: self._on_day_change())

        # Forward focus events for external handling
        for cb in (self.year_cb, self.month_cb, self.day_cb):
            cb.bind("<FocusIn>", lambda e: self.event_generate("<<DatePickerFocusIn>>"))
            cb.bind("<FocusOut>", lambda e: self.event_generate("<<DatePickerFocusOut>>"))

    def _on_ym_change(self):
        current_day = self.day_cb.get()
        self._refresh_days()
        # Clamp day if out of range
        days = set(self.day_cb.cget("values"))
        if current_day in days:
            self.day_cb.set(current_day)
        else:
            vals = self.day_cb.cget("values")
            if vals:
                self.day_cb.set(vals[-1])
        self._apply_constraints()
        self.event_generate("<<DatePickerChanged>>")

    def _on_day_change(self):
        self._apply_constraints()
        self.event_generate("<<DatePickerChanged>>")

    def _refresh_days(self):
        try:
            y = int(self.year_cb.get())
            m = int(self.month_cb.get())
        except ValueError:
            y, m = datetime.today().year, datetime.today().month
        max_day = calendar.monthrange(y, m)[1]
        self.day_cb["values"] = [str(d).zfill(2) for d in range(1, max_day + 1)]

    def get_date(self):
        y = int(self.year_cb.get())
        m = int(self.month_cb.get())
        d = int(self.day_cb.get())
        return date_cls(y, m, d)

    def set_date(self, d):
        self.year_cb.set(str(d.year))
        self.month_cb.set(str(d.month).zfill(2))
        self._refresh_days()
        day_str = str(d.day).zfill(2)
        vals = self.day_cb.cget("values")
        if day_str not in vals:
            day_str = vals[-1]
        self.day_cb.set(day_str)
        self._apply_constraints()
        self.event_generate("<<DatePickerChanged>>")

    def set_min_date(self, d):
        self.min_date = d
        self._apply_constraints()

    def set_max_date(self, d):
        self.max_date = d
        self._apply_constraints()

    def _apply_constraints(self):
        try:
            current = self.get_date()
        except Exception:
            return
        target = current
        if self.min_date and target < self.min_date:
            target = self.min_date
        if self.max_date and target > self.max_date:
            target = self.max_date
        if target != current:
            # avoid recursion by setting without firing extra events
            self.year_cb.set(str(target.year))
            self.month_cb.set(str(target.month).zfill(2))
            self._refresh_days()
            self.day_cb.set(str(target.day).zfill(2))


class DateCalculator:
    def __init__(self, root):
        self.root = root
        self.root.title("Travel Day Calculator")
        self.date_pairs = []
        self.suspend_scroll = False

        # Main container
        self.main_frame = ttk.Frame(root)
        self.main_frame.pack(padx=10, pady=10, fill=tk.BOTH, expand=True)

        # Scrollable canvas setup
        self.canvas = tk.Canvas(self.main_frame)
        self.scrollbar = ttk.Scrollbar(
            self.main_frame, orient="vertical", command=self.canvas.yview
        )
        self.scrollable_frame = ttk.Frame(self.canvas)

        # Configure scrolling
        self.scrollable_frame.bind(
            "<Configure>", lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all"))
        )
        self.canvas.create_window((0, 0), window=self.scrollable_frame, anchor="nw")
        self.canvas.configure(yscrollcommand=self.scrollbar.set)

        # Mousewheel binding
        self.scrollable_frame.bind("<Enter>", self.bind_mousewheel)
        self.scrollable_frame.bind("<Leave>", self.unbind_mousewheel)

        # Header
        ttk.Label(self.scrollable_frame, text="Select Date Ranges").grid(
            row=0, column=0, columnspan=3, pady=5
        )

        # Initial pair
        self.add_date_pair()

        # Controls
        self.controls_frame = ttk.Frame(self.scrollable_frame)
        self.controls_frame.grid(row=999, column=0, columnspan=3, pady=10)

        ttk.Button(self.controls_frame, text="Add Date Range", command=self.add_date_pair).pack(
            side=tk.LEFT, padx=5
        )
        ttk.Button(self.controls_frame, text="Calculate Total", command=self.calculate_total).pack(
            side=tk.LEFT, padx=5
        )

        # Result display
        self.result_text = tk.Text(self.scrollable_frame, height=5, wrap=tk.NONE)
        self.result_text.grid(row=1000, column=0, columnspan=3, pady=10, sticky="ew")

        # Layout
        self.canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

    def bind_mousewheel(self, event):
        # Bind only to canvas to avoid hijacking events from date pickers
        self.canvas.bind("<MouseWheel>", self.on_mousewheel)
        self.canvas.bind("<Button-4>", self.on_mousewheel_linux)
        self.canvas.bind("<Button-5>", self.on_mousewheel_linux)

    def unbind_mousewheel(self, event):
        self.canvas.unbind("<MouseWheel>")
        self.canvas.unbind("<Button-4>")
        self.canvas.unbind("<Button-5>")

    def add_date_pair(self):
        pair_number = len(self.date_pairs) + 1
        row = len(self.date_pairs) * 3 + 1

        # Create entry pair
        ttk.Label(self.scrollable_frame, text=f"Range {pair_number} Start:").grid(
            row=row, column=0, padx=5, pady=2, sticky="w"
        )
        start_entry = ComboDatePicker(self.scrollable_frame)
        start_entry.grid(row=row, column=1, padx=5, pady=2)

        ttk.Label(self.scrollable_frame, text=f"Range {pair_number} End:").grid(
            row=row + 1, column=0, padx=5, pady=2, sticky="w"
        )
        end_entry = ComboDatePicker(self.scrollable_frame)
        end_entry.grid(row=row + 1, column=1, padx=5, pady=2)

        # Spacer separator for visual separation between pairs
        sep = ttk.Separator(self.scrollable_frame, orient="horizontal")
        sep.grid(row=row + 2, column=0, columnspan=3, sticky="ew", pady=(6, 8))

        # Link pickers: enforce start <= end and end >= start
        start_entry.bind(
            "<<DatePickerChanged>>",
            lambda e, s=start_entry, e2=end_entry: self.on_start_date_change(s, e2),
        )
        end_entry.bind(
            "<<DatePickerChanged>>",
            lambda e, s=start_entry, e2=end_entry: self.on_end_date_change(s, e2),
        )
        # Suspend scroll while editing dates to keep interactions responsive
        start_entry.bind("<<DatePickerFocusIn>>", lambda e: self.set_suspend_scroll(True))
        end_entry.bind("<<DatePickerFocusIn>>", lambda e: self.set_suspend_scroll(True))
        start_entry.bind("<<DatePickerFocusOut>>", lambda e: self.set_suspend_scroll(False))
        end_entry.bind("<<DatePickerFocusOut>>", lambda e: self.set_suspend_scroll(False))

        # Initialize constraints based on current values
        self.on_start_date_change(start_entry, end_entry)

        self.date_pairs.append((start_entry, end_entry))
        self.canvas.configure(scrollregion=self.canvas.bbox("all"))

    def set_suspend_scroll(self, value):
        self.suspend_scroll = bool(value)

    def on_start_date_change(self, start_entry, end_entry):
        # When start changes, set end's minimum date and auto-correct if needed
        try:
            start_date = start_entry.get_date()
        except Exception:
            return
        end_entry.set_min_date(start_date)
        try:
            end_date = end_entry.get_date()
        except Exception:
            end_date = None
        if end_date and end_date < start_date:
            end_entry.set_date(start_date)

    def on_end_date_change(self, start_entry, end_entry):
        # When end changes, set start's maximum date and auto-correct if needed
        try:
            end_date = end_entry.get_date()
        except Exception:
            return
        start_entry.set_max_date(end_date)
        try:
            start_date = start_entry.get_date()
        except Exception:
            start_date = None
        if start_date and start_date > end_date:
            start_entry.set_date(end_date)

    def get_period_start(self, dt):
        if (dt.month < 9) or (dt.month == 9 and dt.day < 17):
            return datetime(dt.year - 1, 9, 17)
        else:
            return datetime(dt.year, 9, 17)

    def calculate_total(self):
        yearly_totals = defaultdict(int)
        errors = []

        for i, (start, end) in enumerate(self.date_pairs, 1):
            try:
                # Use native date objects from ComboDatePicker to avoid format issues
                s = start.get_date()
                e = end.get_date()
                start_date = datetime(s.year, s.month, s.day)
                end_date = datetime(e.year, e.month, e.day)

                if end_date < start_date:
                    errors.append(f"Range {i}: End date before start date")
                    continue

                current_period_start = self.get_period_start(start_date)
                while current_period_start <= end_date:
                    current_period_end = current_period_start.replace(
                        year=current_period_start.year + 1
                    )
                    effective_end = current_period_end - timedelta(days=1)

                    overlap_start = max(start_date, current_period_start)
                    overlap_end = min(end_date, effective_end)

                    if overlap_start <= overlap_end:
                        days = (overlap_end - overlap_start).days + 1
                        yearly_totals[current_period_start.year] += days

                    current_period_start = current_period_end

            except Exception:
                errors.append(f"Range {i}: Invalid date format")

        if errors:
            messagebox.showerror("Validation Errors", "\n".join(errors))

        # Display results
        self.result_text.delete("1.0", tk.END)
        self.result_text.insert(tk.END, "Days per September Year:\n")
        for year in sorted(yearly_totals.keys()):
            self.result_text.insert(
                tk.END, f"Sep {year}-Sep {year + 1}: {yearly_totals[year]} days\n"
            )

        self.canvas.configure(scrollregion=self.canvas.bbox("all"))

    def on_mousewheel(self, event):
        if self.suspend_scroll:
            return
        self.canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")

    def on_mousewheel_linux(self, event):
        if self.suspend_scroll:
            return
        if event.num == 4:
            self.canvas.yview_scroll(-1, "units")
        elif event.num == 5:
            self.canvas.yview_scroll(1, "units")


if __name__ == "__main__":
    root = tk.Tk()
    root.geometry("500x500")
    DateCalculator(root)
    root.mainloop()


