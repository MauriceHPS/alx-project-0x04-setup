import {
  AppDispatch,
  decrement,
  increment,
  useAppDispatch,
} from "@/store/store";
import { RootState } from "@/store/store";
import React from "react";
import { useSelector } from "react-redux";

const CounterApp: React.FC = () => {
  const count = useSelector((state: RootState) => state.counter.value);
  const dispatch: AppDispatch = useAppDispatch();

  return (
    <>
      <div
        className="min-h-screen bg-linear-to-r from-yellow-400 to-pink-500 flex flex-col
      justify-center items-center text-white
      "
      >
        {/* Title */}
        <h1 className="text-6xl font-extrabold mb-6">Fun Counter App</h1>
        {/* Funny Message */}
        <p className="text-lg font-medium mb-4">
          Current count: {count}{" "}
          {count === 0
            ? "No Clicks yet"!
            : count % 10 === 0 && count !== 0
            ? "You're on fire"
            : ""}
        </p>
        {/* Counter Display */}
        <div className="text-6xl fount-bold mb-8">{count}</div>
        {/* Buttons */}
        <div>
          <button
            onClick={() => dispatch(increment())}
            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 
            px-8 rounded-full text-lg transition duration-300 shadow-lg transform hover:scale-105
            "
          >
            Increment
          </button>
          <button
            onClick={() => dispatch(decrement())}
            className="bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-8 
             rounded-full text-lg transition duration-300 shadow-lg transform hover:scale-105
            "
          >
            Decrement
          </button>
        </div>
        {/* Footer Message */}
        <p className="mt-8 text-sm text-white opacity-75">
          Keep clicking, who knows what happens at 100?
        </p>
      </div>
    </>
  );
};

export default CounterApp;
