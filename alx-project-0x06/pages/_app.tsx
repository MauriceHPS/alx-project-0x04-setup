import Layout from "@/components/layouts/Layout";
import store from "@/store/store";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Provider } from "react-redux";

import { CountProvider } from "@/context/CountContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Provider store={store}>
        <CountProvider>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </CountProvider>
      </Provider>
    </>
  );
}
