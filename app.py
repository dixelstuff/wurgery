"""Run with: python -m streamlit run app.py"""

import os
from pathlib import Path

import streamlit as st

from wurgery.dictionary import discover_files, load_dictionary
from wurgery.engine import find_solutions
from wurgery.scoring import result_rows

ROOT = Path(__file__).resolve().parent


@st.cache_data(show_spinner=False)
def cached_dictionary(signature):
    # File paths, sizes and modification times invalidate cache when lists change.
    return load_dictionary([entry[0] for entry in signature])


def main():
    st.set_page_config(page_title="Wurgery — Puzzle Explorer", layout="wide")
    st.title("Wurgery — Puzzle Explorer")
    st.write("Find shorter words that require one transplant and one excision, in either order. "
             "Both chunks must contain at least two letters.")

    paths = [ROOT / "wordlists"]
    paths.extend(Path(p) for p in os.environ.get("WURGERY_WORDLIST_PATHS", "").split(os.pathsep) if p)
    try:
        files = discover_files(paths)
        signature = tuple((str(p), p.stat().st_size, p.stat().st_mtime_ns) for p in files)
        dictionary = cached_dictionary(signature)
    except (OSError, UnicodeError, ValueError) as error:
        st.error(str(error))
        return

    st.caption(f"{len(dictionary.words):,} dictionary words from {len(dictionary.files)} file(s). "
               "Frequency ranks results; it never excludes words.")
    with st.form("search"):
        source = st.text_input("Starting word", value="GIGANTIC")
        minimum = st.number_input("Minimum target length", min_value=1, value=4, step=1)
        submitted = st.form_submit_button("Find Solutions", type="primary")

    if submitted:
        try:
            with st.spinner("Exploring both operation orders…"):
                solutions = find_solutions(source, dictionary.words, min_length=int(minimum), min_chunk_length=2)
                rows = result_rows(solutions)
        except ValueError as error:
            st.error(str(error))
            return
        st.session_state["search_result_chunks2"] = (source.strip().upper(), int(minimum), rows)

    if "search_result_chunks2" in st.session_state:
        searched_source, searched_minimum, rows = st.session_state["search_result_chunks2"]
        st.write(f"**{len(rows)} solutions** for **{searched_source}** "
                 f"(at least {searched_minimum} letters)")
        if not rows:
            st.info("No solutions found. Try another starting word or a shorter minimum length.")
            return
        st.caption("Word frequency is wordfreq's English Zipf score: higher means more familiar; "
                   "0 means unscored or very rare. Indices [start:end] are zero-based and "
                   "end-exclusive. A transplant destination is a gap in the remainder after removal.")
        st.dataframe(
            rows,
            hide_index=True,
            width="stretch",
            row_height=105,
            column_config={
                "Target word": st.column_config.TextColumn(width="small"),
                "Word frequency score": st.column_config.NumberColumn(format="%.2f", width="medium"),
                "Operation order": st.column_config.TextColumn(width="medium"),
                "Transformation sequence": st.column_config.TextColumn(width="large"),
            },
        )


if __name__ == "__main__":
    main()
