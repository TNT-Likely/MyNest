package downloader

import "context"

type Status struct {
	GID           string
	Status        string
	TotalLength   int64
	CompletedLength int64
	DownloadSpeed int64
	ErrorMessage  string
	Files         []File
}

type File struct {
	Path   string
	Length int64
}

type Downloader interface {
	AddURI(ctx context.Context, uris []string, options map[string]interface{}) (gid string, err error)
	TellStatus(ctx context.Context, gid string) (*Status, error)
	Remove(ctx context.Context, gid string) error
	Pause(ctx context.Context, gid string) error
	Unpause(ctx context.Context, gid string) error
	GetVersion(ctx context.Context) (map[string]interface{}, error)
	GetGlobalOption(ctx context.Context) (map[string]interface{}, error)
}