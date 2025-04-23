import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  getYear,
  getMonth,
  getDate,
  getDaysInMonth,
  newDate,
} from "date-fns-jalali";
import "./MonthYearSelector.css";

// --- Types ---
type SelectedDateInfo = {
  selectedMonthIndex: number;
  selectedYear: number;
  selectedDay: number;
  date: Date; // The underlying Date object
};

interface MonthYearSelectorProps {
  onChange?: (info: SelectedDateInfo) => void;
  initialDate?: Date;
  // Add other props here if needed, e.g., initialDate
}

type ColumnType = "month" | "year" | "day";

// --- Constants ---
const jalaliMonths: string[] = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

const ITEM_HEIGHT = 34;
const SCROLL_DEBOUNCE_DELAY = 150;
const SNAP_DELAY = 50;

// --- Component ---
const MonthYearSelector: React.FC<MonthYearSelectorProps> = ({
  onChange,
  initialDate,
}) => {
  const now = new Date();
  const currentJalaliYear = getYear(initialDate ? initialDate : now);
  const currentJalaliMonthIndex = getMonth(initialDate ? initialDate : now); // 0-indexed
  const currentJalaliDay = getDate(initialDate ? initialDate : now);

  const years: number[] = Array.from(
    { length: 80 },
    (_, i) => getYear(now) - 79 + i,
  );

  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(
    currentJalaliMonthIndex,
  );
  const [selectedYear, setSelectedYear] = useState<number>(currentJalaliYear);
  const [selectedDay, setSelectedDay] = useState<number>(currentJalaliDay);
  const [daysInMonth, setDaysInMonth] = useState<number[]>([]);

  const monthColRef = useRef<HTMLDivElement>(null);
  const yearColRef = useRef<HTMLDivElement>(null);
  const dayColRef = useRef<HTMLDivElement>(null);
  const monthScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const yearScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const dayScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isMonthSnappingRef = useRef<boolean>(false);
  const isYearSnappingRef = useRef<boolean>(false);
  const isDaySnappingRef = useRef<boolean>(false);
  const draggingColRef = useRef<ColumnType | null>(null);
  const startYRef = useRef<number>(0);
  const initialScrollTopRef = useRef<number>(0);

  // Notify parent component of changes
  useEffect(() => {
    const date = newDate(selectedYear, selectedMonthIndex, selectedDay);
    onChange?.({
      selectedMonthIndex,
      selectedYear,
      selectedDay,
      date,
    });
  }, [selectedMonthIndex, selectedYear, selectedDay, onChange]);

  // Update the days array based on selected Jalali month and year
  useEffect(() => {
    // Use newDate from date-fns-jalali to create a representative date
    const selectedDate = newDate(selectedYear, selectedMonthIndex, 1);
    const days = getDaysInMonth(selectedDate);
    const newDaysArray = Array.from({ length: days }, (_, i) => i + 1);
    setDaysInMonth(newDaysArray);

    // Adjust selected day if it's no longer valid
    if (selectedDay > days) {
      setSelectedDay(days);
    }
  }, [selectedMonthIndex, selectedYear]); // Removed selectedDay dependency to avoid loops when day is adjusted

  // Function to calculate and set scroll position to center an item
  const scrollToCenter = (
    element: HTMLDivElement | null,
    index: number,
    behavior: ScrollBehavior = "auto",
  ) => {
    if (element) {
      element.scrollTo({
        top: index * ITEM_HEIGHT,
        behavior: behavior,
      });
    }
  };

  // Initial scroll positioning
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToCenter(monthColRef.current, selectedMonthIndex, "auto");

      const initialYearIndex = years.findIndex((y) => y === selectedYear);
      if (initialYearIndex !== -1) {
        scrollToCenter(yearColRef.current, initialYearIndex, "auto");
      }

      if (daysInMonth.length > 0) {
        const initialDayIndex = daysInMonth.findIndex((d) => d === selectedDay);
        if (initialDayIndex !== -1) {
          scrollToCenter(dayColRef.current, initialDayIndex, "auto");
        } else if (selectedDay > daysInMonth.length) {
          scrollToCenter(dayColRef.current, daysInMonth.length - 1, "auto");
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedMonthIndex, selectedYear, selectedDay, daysInMonth]); // Dependencies updated

  // --- Scroll Handlers with Snap Logic ---
  const handleScrollEnd = (
    element: HTMLDivElement | null,
    items: Array<string | number>,
    setSelected: React.Dispatch<React.SetStateAction<number>>,
    isSnappingRef: React.MutableRefObject<boolean>,
    timeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
    type: ColumnType,
  ) => {
    if (!element) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      isSnappingRef.current = true;

      const scrollTop = element.scrollTop;
      const centeredIndex = Math.round(scrollTop / ITEM_HEIGHT);
      const clampedIndex = Math.max(
        0,
        Math.min(items.length - 1, centeredIndex),
      );

      if (items && items.length > clampedIndex) {
        const newValue = items[clampedIndex];

        if (type === "month") {
          setSelected(clampedIndex);
        } else {
          setSelected(newValue as number); // Year and Day are numbers
        }

        scrollToCenter(element, clampedIndex, "smooth");
      } else {
        console.warn(
          `Scroll end handler: Invalid index ${clampedIndex} for items list.`,
        );
        isSnappingRef.current = false;
        return;
      }

      setTimeout(() => {
        isSnappingRef.current = false;
      }, SNAP_DELAY);
    }, SCROLL_DEBOUNCE_DELAY);
  };

  // Memoized scroll handlers
  const handleMonthScroll = useCallback(() => {
    if (isMonthSnappingRef.current || draggingColRef.current === "month")
      return;
    handleScrollEnd(
      monthColRef.current,
      jalaliMonths,
      setSelectedMonthIndex,
      isMonthSnappingRef,
      monthScrollTimeoutRef,
      "month",
    );
  }, []);

  const handleYearScroll = useCallback(() => {
    if (isYearSnappingRef.current || draggingColRef.current === "year") return;
    handleScrollEnd(
      yearColRef.current,
      years,
      setSelectedYear,
      isYearSnappingRef,
      yearScrollTimeoutRef,
      "year",
    );
  }, [years]);

  const handleDayScroll = useCallback(() => {
    if (isDaySnappingRef.current || draggingColRef.current === "day") return;
    handleScrollEnd(
      dayColRef.current,
      daysInMonth,
      setSelectedDay,
      isDaySnappingRef,
      dayScrollTimeoutRef,
      "day",
    );
  }, [daysInMonth]);

  // --- Drag Handlers ---
  const handleDragStart = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
    type: ColumnType,
  ) => {
    draggingColRef.current = type;
    let colRef: React.RefObject<HTMLDivElement>;
    if (type === "month") colRef = monthColRef;
    else if (type === "year") colRef = yearColRef;
    else colRef = dayColRef;

    if (!colRef.current) return;

    // Check if 'touches' exists (TouchEvent) or use clientY (MouseEvent)
    startYRef.current = "touches" in e ? e.touches[0].clientY : e.clientY;
    initialScrollTopRef.current = colRef.current.scrollTop;

    // Add listeners correctly typed for window events
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("touchmove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchend", handleDragEnd);

    colRef.current.style.cursor = "grabbing";
    colRef.current.style.userSelect = "none";

    let timeoutRef: React.MutableRefObject<ReturnType<
      typeof setTimeout
    > | null>;
    if (type === "month") timeoutRef = monthScrollTimeoutRef;
    else if (type === "year") timeoutRef = yearScrollTimeoutRef;
    else timeoutRef = dayScrollTimeoutRef;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Prevent default only for touch events to allow scrolling
    if (e.type === "touchstart" && e.cancelable) {
      // e.preventDefault(); // Re-evaluate if needed, might prevent native scroll feel
    }
  };

  const handleDragMove = (e: MouseEvent | TouchEvent) => {
    const type = draggingColRef.current;
    if (!type) return;

    let colRef: React.RefObject<HTMLDivElement>;
    if (type === "month") colRef = monthColRef;
    else if (type === "year") colRef = yearColRef;
    else colRef = dayColRef;

    if (!colRef.current) return;

    const currentY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const deltaY = currentY - startYRef.current;
    colRef.current.scrollTop = initialScrollTopRef.current - deltaY;
  };

  const handleDragEnd = () => {
    const type = draggingColRef.current;
    if (!type) return;

    let colRef: React.RefObject<HTMLDivElement>;
    let items: Array<string | number>;
    let setSelected: React.Dispatch<React.SetStateAction<number>>;
    let isSnappingRef: React.MutableRefObject<boolean>;
    let timeoutRef: React.MutableRefObject<ReturnType<
      typeof setTimeout
    > | null>;

    if (type === "month") {
      colRef = monthColRef;
      items = jalaliMonths;
      setSelected = setSelectedMonthIndex;
      isSnappingRef = isMonthSnappingRef;
      timeoutRef = monthScrollTimeoutRef;
    } else if (type === "year") {
      colRef = yearColRef;
      items = years;
      setSelected = setSelectedYear;
      isSnappingRef = isYearSnappingRef;
      timeoutRef = yearScrollTimeoutRef;
    } else {
      colRef = dayColRef;
      items = daysInMonth;
      setSelected = setSelectedDay;
      isSnappingRef = isDaySnappingRef;
      timeoutRef = dayScrollTimeoutRef;
    }

    draggingColRef.current = null;

    window.removeEventListener("mousemove", handleDragMove);
    window.removeEventListener("touchmove", handleDragMove);
    window.removeEventListener("mouseup", handleDragEnd);
    window.removeEventListener("touchend", handleDragEnd);

    if (colRef.current) {
      colRef.current.style.cursor = "grab";
      colRef.current.style.userSelect = "";
    }

    if (items && items.length > 0) {
      handleScrollEnd(
        colRef.current,
        items,
        setSelected,
        isSnappingRef,
        timeoutRef,
        type,
      );
    }
  };

  // Effect for cleaning up window listeners
  useEffect(() => {
    const cleanup = () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("touchmove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchend", handleDragEnd);
    };
    return cleanup;
  }, []);

  // --- Render ---
  return (
    <div className="month-year-selector">
      {/* Day Column */}
      <div
        className="column day-column"
        ref={dayColRef}
        onScroll={handleDayScroll}
        onMouseDown={(e) => handleDragStart(e, "day")}
        onTouchStart={(e) => handleDragStart(e, "day")}
      >
        {daysInMonth.map((day) => (
          <div key={day} className="item">
            {day}
          </div>
        ))}
      </div>
      {/* Month Column */}
      <div
        className="column month-column"
        ref={monthColRef}
        onScroll={handleMonthScroll}
        onMouseDown={(e) => handleDragStart(e, "month")}
        onTouchStart={(e) => handleDragStart(e, "month")}
      >
        {jalaliMonths.map((month) => (
          <div key={month} className="item">
            {month}
          </div>
        ))}
      </div>

      {/* Year Column */}
      <div
        className="column year-column"
        ref={yearColRef}
        onScroll={handleYearScroll}
        onMouseDown={(e) => handleDragStart(e, "year")}
        onTouchStart={(e) => handleDragStart(e, "year")}
      >
        {years.map((year) => (
          <div key={year} className="item">
            {year}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MonthYearSelector;
