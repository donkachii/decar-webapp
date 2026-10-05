import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage } from "zustand/middleware";

/** Zustand persistence on the phone (the website uses a cookie and localStorage). */
export const phoneStorage = createJSONStorage(() => AsyncStorage);
