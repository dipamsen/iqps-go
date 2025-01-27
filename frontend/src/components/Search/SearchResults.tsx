import { useEffect, useState } from 'react';
import { ISearchResult } from '../../types/question_paper';
import { copyLink } from '../../utils/copyLink';
import Spinner from '../Spinner/Spinner';
import './search_results.scss';
import { IoLink } from 'react-icons/io5';
import { FaFilePdf } from 'react-icons/fa6';
import { Select } from '../Common/Form';
import { useAuthContext } from '../../utils/auth';

type SortBy = 'relevance' | 'course_name' | 'year';
type SortOrder = 'ascending' | 'descending';
type FilterByYear = number | null;
type FilterFields = 'filterByYear' | 'sortBy' | 'sortOrder';

interface ISearchResultsProps {
	awaitingResults: boolean;
	success: boolean;
	msg: string;
	results: ISearchResult[];
}
function SearchResults(props: ISearchResultsProps) {
	const [displayedResults, setDisplayedResults] = useState<ISearchResult[]>(props.results);
	const [filterByYear, setFilterByYear] = useState<FilterByYear>(null);
	const [sortBy, setSortBy] = useState<SortBy>('relevance');
	const [sortOrder, setSortOrder] = useState<SortOrder>('descending');
	const [availableYears, setAvailableYears] = useState<number[]>([]);

	const updateFilters = (field: FilterFields, value: string) => {
		switch (field) {
			case 'filterByYear':
				setFilterByYear(value === 'null' ? null : parseInt(value));
				break;
			case 'sortBy':
				setSortBy(value as SortBy);
				break;
			case 'sortOrder':
				setSortOrder(value as SortOrder);
				break;
		}
	}

	const updateDisplayedResults = () => {
		let filtered_results = props.results.slice();
		if (filterByYear !== null) filtered_results = filtered_results.filter((result) => result.year === filterByYear);

		if (sortBy === 'relevance') {
			setDisplayedResults(filtered_results);
			return;
		}

		const sorted_results = filtered_results.sort((a, b) => {
			// Fall back to course name sorting when results are filtered by year.
			const fallback_sorting = sortBy === 'year' && filterByYear !== null;

			const sort_by: SortBy = fallback_sorting ? 'course_name' : sortBy;
			const sort_order: SortOrder = fallback_sorting ? 'ascending' : sortOrder;

			const first = sort_order === "ascending" ? a : b;
			const second = sort_order === "ascending" ? b : a;

			switch (sort_by) {
				case "year":
					return first.year - second.year;
				case "course_name":
					return first.course_name.localeCompare(second.course_name);
			}
		});

		setDisplayedResults(sorted_results);
	}

	// To update when new results are fetched
	useEffect(() => {
		const unique_years: Set<number> = new Set();

		props.results.forEach((result) => unique_years.add(result.year));
		setAvailableYears(Array.from(unique_years.values()).sort().reverse());
		setFilterByYear(null);

		updateDisplayedResults();
	}, [props.results])

	// To update when filters are changed
	useEffect(updateDisplayedResults, [filterByYear, sortBy, sortOrder])

	return <div className="search-results">
		{
			props.awaitingResults ? <div className="spinner"><Spinner /></div> :
				!props.success ? <p className="message">{props.msg}</p> : (
					<>
						<ResultsFilter
							filterByYear={filterByYear}
							availableYears={availableYears}
							sortBy={sortBy}
							sortOrder={sortOrder}
							updateFilters={updateFilters}
						/>
						{
							displayedResults.length > 0 ? (
								<>
									<div className="search-results">
										{displayedResults.map((result, i) => <ResultCard key={i} {...result} />)}
									</div>
								</>
							) : <p>No results.</p>
						}
					</>
				)
		}
	</div>;
}

interface IResultsFilterProps {
	filterByYear: FilterByYear;
	availableYears: number[];
	sortBy: SortBy;
	sortOrder: SortOrder;
	updateFilters: (field: FilterFields, value: string) => void;
}
function ResultsFilter(props: IResultsFilterProps) {
	return <div className="row results-filter">
		<Select
			value={(props.filterByYear ?? 'null').toString()}
			options={[
				{ value: 'null', title: 'All Years' },
				...props.availableYears.map((year) => {
					return { title: year.toString(), value: year.toString() }
				})
			]}
			onInput={(e) => props.updateFilters('filterByYear', e.currentTarget.value)}
		/>

		<Select
			value={props.sortBy}
			options={[
				{ value: 'relevance', title: 'Sort by Relevance' },
				{ value: 'year', title: 'Sort by Year' },
				{ value: 'course_name', title: 'Sort by Course Name' },
			]}
			onInput={(e) => props.updateFilters('sortBy', e.currentTarget.value)}
		/>

		<Select
			value={props.sortOrder}
			options={[
				{ value: 'ascending', title: 'Ascending' },
				{ value: 'descending', title: 'Descending' }
			]}
			onInput={(e) => props.updateFilters('sortOrder', e.currentTarget.value)}
		/>
	</div>
}

function ResultCard(result: ISearchResult) {
	const auth = useAuthContext();

	const getSemesterTag = (sem: ISearchResult['semester']) => {
		// empty string - N/A
		// midsem - MID; endsem - END
		// ctx - CT1, CT2, etc.
		return sem === '' ? 'N/A' :
			(sem === 'autumn' || sem === 'spring') ?
				sem.slice(0, 3).toUpperCase() :
				sem;
	}

	const getSemesterTooltip = (semester: ISearchResult['semester']) => {
		if (semester.length > 0) {
			return semester[0].toUpperCase() + semester.slice(1) + ' Semester'
		} else {
			return "Unknown Semester";
		}
	}

	const getExamTag = (exam: ISearchResult['exam']) => {
		// empty string - Unknown
		// midsem - Midsem; endsem - Endsem
		// ctx - Class Test 1, Class Test 2, etc.
		return exam === '' ? 'Unknown' :
			(exam === 'midsem' || exam === 'endsem') ?
				exam.slice(0, 3).toUpperCase() :
				exam.toUpperCase();
	}

	const getExamTooltip = (exam: ISearchResult['exam']) => {
		// empty string - Unknown
		// midsem - Midsem; endsem - Endsem
		// ctx - Class Test 1, Class Test 2, etc.
		return exam === '' ? 'Unknown' :
			(exam === 'midsem' || exam === 'endsem') ?
				exam[0].toUpperCase() + exam.slice(1) :
				`Class Test ${exam.slice(2).length > 0 ? exam.slice(2) : '?'}`;
	}

	const getTitle = () => {
		let title = `${result.course_name}`;

		if (result.course_code) title += ` (${result.course_code})`;

		return title;
	}

	return <div className="result-card">
		<p className="result-card-info">
			<p className="result-card-title">{getTitle()}</p>
			<div className="result-card-tags">
				<span className="result-card-tag">{result.year}</span>
				<span className="result-card-tag" title={getExamTooltip(result.exam)}>{getExamTag(result.exam)}</span>
				<span className="result-card-tag" title={getSemesterTooltip(result.semester)}>{getSemesterTag(result.semester)}</span>
				{result.note !== "" && <span className="result-card-tag">{result.note}</span>}
				{auth.isAuthenticated && <span className="result-card-tag">id: {result.id}</span>}
			</div>
		</p>
		<div className="result-card-btns">
			<a
				className="result-card-btn icon-btn"
				href={result.filelink}
				title="Open PDF"
				target="_blank"
				rel="noopener noreferrer"
			>
				<FaFilePdf size="1.2rem" />
			</a>
			<button
				className="result-card-btn icon-btn"
				title="Share PDF"
				onClick={(e) => copyLink(e, result.filelink)}
			>
				<IoLink size="1.2rem" />
			</button>
		</div>
	</div>;
}

export default SearchResults;