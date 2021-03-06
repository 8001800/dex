package wrappers

import (
	"database/sql/driver"
	"strings"

	"github.com/ethereum/go-ethereum/common"
)

// Address is a wrapper around common.Address with additional functionalities
type Address struct {
	common.Address
}

// Scan implements Scanner.Scan for common.Address
func (a *Address) Scan(value interface{}) error {
	hex := strings.TrimPrefix(strings.TrimPrefix(value.(string), "0X"), "0x")
	a.SetBytes(common.Hex2Bytes(hex))
	return nil
}

// Value implements driver.Valuer interface
func (a *Address) Value() (driver.Value, error) {
	return a.Hex(), nil
}

// WrapAddress wraps common.Address
func WrapAddress(a *common.Address) *Address {
	return &Address{*a}
}
