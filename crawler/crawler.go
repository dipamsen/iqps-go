package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/gocolly/colly"
)

type QuestionPaper struct {
	ID          int    `json:"id"`
	CourseCode  string `json:"course_code"`
	CourseName  string `json:"course_name"`
	Year        int    `json:"year"`
	Exam        string `json:"exam"`
	FileLink    string `json:"filelink"`
	FromLibrary bool   `json:"from_library"`
}

type qpRaw struct {
	CourseCode string `json:"course_code"`
	Filename   string `json:"filename"`
	Name       string `json:"name"`
	Year       int    `json:"year"`
	ExamType   string `json:"exam_type"`
	Semester   string `json:"semester"`
	Url        string `json:"url"`
}

func downloadFile(new_qp qpRaw) {
	res, err := http.Get(new_qp.Url)
	if err != nil {
		fmt.Println(err)
		return
	}

	if res.StatusCode != 200 {
		fmt.Printf("Failed to download file: %s. Status Code: %d", new_qp.Name, res.StatusCode)
		return
	}

	defer res.Body.Close()

	file, err := os.Create("./qp/" + new_qp.Filename)
	if err != nil {
		fmt.Println(err)
	}

	_, err = io.Copy(file, res.Body)
	if err != nil {
		fmt.Println(err)
	}
	defer file.Close()
}

func sanitizeFilename(s string) string {
	// replaces all spaces with _
	return strings.ReplaceAll(s, "%20", "_")
}

func main() {
	c := colly.NewCollector(
		colly.AllowedDomains("10.18.24.75"),
		colly.MaxDepth(9),
	)

	coursesFile, err := os.Open("../frontend/src/data/courses.json")
	if err != nil {
		fmt.Println("Error opening file:", err)
		return
	}

	byteValue, err := io.ReadAll(coursesFile)
	if err != nil {
		fmt.Println("Error reading file:", err)
		return
	}

	var courses map[string]interface{}
	err = json.Unmarshal(byteValue, &courses)
	if err != nil {
		fmt.Println("Error decoding JSON:", err)
		return
	}

	// res, err := http.Get("https://iqps-server.metakgp.org/library")
	// if err != nil {
	// 	fmt.Println(err)
	// }
	// defer res.Body.Close()

	var existing_qp []QuestionPaper
	// json.NewDecoder(res.Body).Decode(&existing_qp)

	var new_qp []qpRaw

	c.OnHTML("a[href]", func(e *colly.HTMLElement) {
		if e.Text == "Parent Directory" || e.Text == "Name" || e.Text == "Last modified" || e.Text == "Size" || e.Text == "Description" {
			return
		}
		link := e.Attr("href")
		file_url := e.Request.AbsoluteURL(link)
		var name string
		var year int
		var exam_type string
		var sem string

		if strings.Contains(file_url, ".pdf") {
			temp := strings.Split(file_url, "/")
			name = temp[len(temp)-1]
			year, _ = strconv.Atoi(temp[4])
			details := strings.ToLower(temp[5])
			if strings.Contains(details, "mid") {
				exam_type = "mid"
			} else if strings.Contains(details, "end") {
				exam_type = "end"
			} else {
				exam_type = ""
			}
			if strings.Contains(details, "aut") {
				sem = "autumn"
			} else if strings.Contains(details, "spr") {
				sem = "spring"
			} else {
				sem = ""
			}

			// as per 16/09/2024, filenames in library are of the form course-code_course-name_extra-details,
			// extracting course_code from the filename since course_code is a mandatory field
			pattern := `\b\w{2}\d{5}\b`
			re := regexp.MustCompile(pattern)
			course_code := ""
			name_split := strings.Split(name[:len(name)-4], "_")

			if len(name_split[0]) == 7 && re.MatchString(name_split[0]) {
				// what to do if there are multiple course codes in the filename?
				course_code = name_split[0]
				name_split = name_split[1:]
			}
			// strip off extra details from the end of the filename
			if len(name_split) > 0 && name_split[len(name_split)-1] == "2024" {
				name_split = name_split[:len(name_split)-1]
			}
			types := []string{"EA", "MA", "ES", "MS"}
			for _, code := range types {
				if len(name_split) > 0 && code == name_split[len(name_split)-1] {
					name_split = name_split[:len(name_split)-1]
					break
				}
			}
			name = strings.Join(name_split, " ")
			if len(name) < 5 { // assuming course name is at least 5 characters long
				name = ""
			}

			for i := range existing_qp {
				if existing_qp[i].CourseCode == course_code && existing_qp[i].Year == year && existing_qp[i].Exam == exam_type {
					return
				}
			}

			if courses[course_code] != nil {
				name = courses[course_code].(string)
			}

			new_qp = append(new_qp, qpRaw{course_code, sanitizeFilename(strings.Join(temp[4:], "_")), name, year, exam_type, sem, file_url})
		}

		c.Visit(e.Request.AbsoluteURL(link))
	})

	c.Visit("http://10.18.24.75/peqp/2024")
	c.Wait()

	file, err := os.Create("qp.csv")
	if err != nil {
		fmt.Println("Error creating CSV file:", err)
		return
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	header := []string{"course_code", "course_name", "year", "exam", "semester", "filelink", "from_library", "approve_status"}
	if err := writer.Write(header); err != nil {
		fmt.Println("Error writing header to CSV:", err)
		return
	}

	for i := range new_qp {
		var exam_type string
		if new_qp[i].ExamType != "" {
			exam_type = new_qp[i].ExamType + "sem"
		}

		var is_approved string
		if new_qp[i].CourseCode == "" || new_qp[i].Name == "" {
			is_approved = "false"
			if new_qp[i].CourseCode == "" {
				new_qp[i].CourseCode = "UNKNOWN"
			}
			if new_qp[i].Name == "" {
				new_qp[i].Name = "UNKNOWN"
			}
		} else {
			is_approved = "true"
		}

		row := []string{
			new_qp[i].CourseCode,
			new_qp[i].Name,
			fmt.Sprint(new_qp[i].Year),
			exam_type,
			new_qp[i].Semester,
			"peqp/qp/" + new_qp[i].Filename,
			"true",
			is_approved,
		}
		if err := writer.Write(row); err != nil {
			fmt.Println("Error writing row to CSV:", err)
			return
		}
	}
	fmt.Println("CSV file created successfully")

	for i := range new_qp {
		fmt.Printf("%d/%d: Downloading %s\n", i+1, len(new_qp), new_qp[i].Name)
		downloadFile(new_qp[i])
	}
}
