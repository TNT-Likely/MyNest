package downloader

import (
	"context"
	"fmt"
	"strconv"

	"github.com/zyxar/argo/rpc"
)

type Aria2Client struct {
	client rpc.Client
	secret string
}

func NewAria2Client(rpcURL, secret string) (*Aria2Client, error) {
	client, err := rpc.New(context.Background(), rpcURL, secret, 0, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create aria2 client: %w", err)
	}

	return &Aria2Client{
		client: client,
		secret: secret,
	}, nil
}

func (a *Aria2Client) AddURI(ctx context.Context, uris []string, options map[string]interface{}) (string, error) {
	fmt.Printf("[Aria2] AddURI called with URIs: %v, Options: %+v\n", uris, options)
	gid, err := a.client.AddURI(uris, options)
	if err != nil {
		fmt.Printf("[Aria2] AddURI failed with error: %v\n", err)
		return "", fmt.Errorf("failed to add URI: %w", err)
	}
	fmt.Printf("[Aria2] Successfully added, GID: %s\n", gid)
	return gid, nil
}

func (a *Aria2Client) TellStatus(ctx context.Context, gid string) (*Status, error) {
	info, err := a.client.TellStatus(gid)
	if err != nil {
		return nil, fmt.Errorf("failed to get status: %w", err)
	}

	totalLen, _ := strconv.ParseInt(info.TotalLength, 10, 64)
	completedLen, _ := strconv.ParseInt(info.CompletedLength, 10, 64)
	downloadSpeed, _ := strconv.ParseInt(info.DownloadSpeed, 10, 64)

	status := &Status{
		GID:             info.Gid,
		Status:          info.Status,
		TotalLength:     totalLen,
		CompletedLength: completedLen,
		DownloadSpeed:   downloadSpeed,
		ErrorMessage:    info.ErrorMessage,
		Files:           make([]File, len(info.Files)),
	}

	for i, f := range info.Files {
		length, _ := strconv.ParseInt(f.Length, 10, 64)
		status.Files[i] = File{
			Path:   f.Path,
			Length: length,
		}
	}

	return status, nil
}

func (a *Aria2Client) Remove(ctx context.Context, gid string) error {
	_, err := a.client.Remove(gid)
	if err != nil {
		return fmt.Errorf("failed to remove download: %w", err)
	}
	return nil
}

func (a *Aria2Client) Pause(ctx context.Context, gid string) error {
	_, err := a.client.Pause(gid)
	if err != nil {
		return fmt.Errorf("failed to pause download: %w", err)
	}
	return nil
}

func (a *Aria2Client) Unpause(ctx context.Context, gid string) error {
	_, err := a.client.Unpause(gid)
	if err != nil {
		return fmt.Errorf("failed to unpause download: %w", err)
	}
	return nil
}

func (a *Aria2Client) GetVersion(ctx context.Context) (map[string]interface{}, error) {
	version, err := a.client.GetVersion()
	if err != nil {
		return nil, fmt.Errorf("failed to get version: %w", err)
	}

	return map[string]interface{}{
		"version": version.Version,
	}, nil
}

func (a *Aria2Client) GetGlobalOption(ctx context.Context) (map[string]interface{}, error) {
	options, err := a.client.GetGlobalOption()
	if err != nil {
		return nil, fmt.Errorf("failed to get global option: %w", err)
	}

	return options, nil
}

func (a *Aria2Client) Close() error {
	return a.client.Close()
}