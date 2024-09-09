import { createRef, Dispatch, MouseEventHandler, useState } from "react";
import { IQuestionPaperFile } from "../../types/question_paper";
import { FileCard } from "./FileCard";
import Spinner from "../Spinner/Spinner";
import { AiOutlineCloudUpload, AiOutlineFileAdd } from "react-icons/ai";
import { isQPValid } from "../../utils/validateInput";
import { UploadDragAndDrop } from "./UploadDragAndDrop";
import PaperEditModal from "./PaperEditModal";
import { autofillData } from "../../utils/autofillData";
import './styles/upload_form.scss';

interface IUploadFormProps {
	max_upload_limit: number;
	awaitingResponse: boolean;

	handleUpload: (qpapers: IQuestionPaperFile[]) => Promise<boolean>;
	setAwaitingResponse: Dispatch<React.SetStateAction<boolean>>;
}
export function UploadForm(props: IUploadFormProps) {
	const [qPapers, setQPapers] = useState<IQuestionPaperFile[]>([]);
	const [selectedQPaper, setSelectedQPaper] =
		useState<IQuestionPaperFile | null>(null);

	const addQPapers = async (newFiles: File[]) => {
		try {
			props.setAwaitingResponse(true); // Set loading state to true
			const newQPsPromises = newFiles.map(async (newFile) => {
				const qpDetails = await autofillData(newFile.name, newFile);
				return { file: newFile, ...qpDetails };
			});

			const newQPs = await Promise.all(newQPsPromises);

			if (newQPs.length > 0) {
				setQPapers((prevQPs) => [...prevQPs, ...newQPs]);
			}
		} catch (error) {
			console.error('Error adding question papers:', error);
		} finally {
			props.setAwaitingResponse(false); // Set loading state to false
		}
	};

	const removeQPaper = (filename: string) => {
		setQPapers((prevQPs) =>
			prevQPs.filter((qp) => qp.file.name !== filename)
		);
	};

	const updateQPaper = (updated: IQuestionPaperFile) => {
		let updateData = qPapers.map((qp) => {
			if (qp.file.name == updated.file.name) return updated;
			else return qp;
		});
		setQPapers(updateData);
	};

	const onUpload: MouseEventHandler = async (e) => {
		e.preventDefault();
		const success = await props.handleUpload(qPapers);

		if (success) setQPapers([]);
	}

	const fileInputRef = createRef<HTMLInputElement>();
	const openFileDialog: MouseEventHandler = (e) => {
		e.stopPropagation();
		fileInputRef.current?.click();
	};

	return <div className="upload-form">
		{
			qPapers.length > 0 ? (
				<>
					<div className="uploaded-files">
						{qPapers.map(
							(qp, i) => <div key={i}>
								<FileCard
									qPaper={qp}
									removeQPaper={removeQPaper}
									edit={setSelectedQPaper}
								/>
								{!isQPValid(qp) && (
									<p className="error-msg">
										Invalid course details
									</p>
								)}
							</div>
						)}
					</div>
					<div className="upload-form-btns">
						<button onClick={onUpload} className="upload-btn">
							{props.awaitingResponse ? (
								<>
									Uploading
									<div className="spinner">
										<Spinner />
									</div>
								</>
							) : (
								<><AiOutlineCloudUpload size="1.5rem" />Upload</>
							)}
						</button>
						{qPapers.length <= props.max_upload_limit && <button onClick={openFileDialog}>
							<AiOutlineFileAdd size="1.5rem" />Add More Files
						</button>}
					</div>
				</>
			) : (
				!props.awaitingResponse && <UploadDragAndDrop max_upload_limit={props.max_upload_limit} fileInputRef={fileInputRef} addQPapers={addQPapers} openFileDialog={openFileDialog} />
			)
		}

		{selectedQPaper !== null && (
			<PaperEditModal
				onClose={() => setSelectedQPaper(null)}
				qPaper={selectedQPaper}
				updateQPaper={updateQPaper}
			/>
		)}
	</div >;
}